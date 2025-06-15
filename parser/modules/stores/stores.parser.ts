import {
  ensureArray,
  logUnrecognizedFormat,
} from "../../utils/general.utils.js";
import { createParser, parseXmlFile } from "../../utils/xml-parser.utils.js";
import { Store } from "./store.entity.js";
import { mapToStore } from "./stores.mapper.js";
import he from "he";

// Entry function: tries each parser in order until one returns results
export async function parseStoreXmlFile(filePath: string): Promise<Store[]> {
  const json = await parseXmlFile(filePath, createParser("stores"));
  if (!json) {
    console.log("Error in stores: parsing file:", filePath);
    return [];
  }

  return (
    (await parseAsxValues(json)) ??
    (await parseStoreBranches(json)) ??
    (await parseRootRow(json)) ??
    (await parseOrderXml(json)) ??
    (await parseRootSubChains(json)) ??
    (await parseRootUppercaseSubChains(json)) ??
    logUnrecognizedFormat(filePath, "stores.parser.ts")
  );
}

// Format 1: <asx:abap><asx:values><STORES><STORE>
async function parseAsxValues(json: any): Promise<Store[] | null> {
  const stores = json["asx:abap"]?.["asx:values"]?.STORES?.STORE;
  if (!stores) return null;
  const chainId = json["asx:abap"]?.["asx:values"]?.CHAINID;

  const list = ensureArray(stores);

  const results = await Promise.all(
    list.map((store) => mapToStore({ ...store, CHAINID: chainId }))
  );
  return results;
}

// Format 2: <Store><Branches><Branch>
async function parseStoreBranches(json: any): Promise<Store[] | null> {
  const branches = json.Store?.Branches?.Branch;
  if (!branches) return null;
  const list = ensureArray(branches);
  const results = await Promise.all(list.map(mapToStore));
  return results;
}

// Format 3: <root><row><_Root_> with inline XML as string content
function fixHebrewEncoding(text: string): string {
  return Buffer.from(text, "latin1").toString("utf8");
}

async function parseRootRow(json: any): Promise<Store[] | null> {
  const rows = json.root?.row;
  if (!Array.isArray(rows)) return null;

  const storeData: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  let currentChainId = "";
  let currentSubChainId = "";

  for (const row of rows) {
    const raw = row._Root_;
    if (!raw) continue;

    const decoded = fixHebrewEncoding(he.decode(raw));

    // אם זה סוף <Store> - נשמור את החנות
    if (decoded.includes("</Store>")) {
      current["ChainId"] = current["ChainId"] || currentChainId;
      current["SubChainId"] = current["SubChainId"] || currentSubChainId;

      if (current["StoreId"] && current["ChainId"] && current["SubChainId"]) {
        storeData.push({ ...current });
      } else {
        console.warn(
          `⚠️ Store not saved: missing ChainId, SubChainId or StoreId. ChainId: ${current["ChainId"]}, SubChainId: ${current["SubChainId"]}, StoreId: ${current["StoreId"]}`
        );
      }

      current = {};
      continue;
    }

    for (const [, key, value] of decoded.matchAll(/<(\w+)>(.*?)<\/\1>/g)) {
      if (key.toLowerCase() === "chainid") currentChainId = value;
      if (key.toLowerCase() === "subchainid") currentSubChainId = value;

      current[key] = value;
    }
  }

  const results = await Promise.all(storeData.map(mapToStore));
  return results;
}

// Format 4: <OrderXml><Envelope><Header><Details><Line>
async function parseOrderXml(json: any): Promise<Store[] | null> {
  const env = json.OrderXml?.Envelope;
  if (!env?.Header?.Details?.Line) return null;
  const lines = ensureArray(env.Header.Details.Line);

  const context = {
    ChainId: String(env.ChainId) || String(env.ChainID),
    SubChainId: String(env.SubChainId) || String(env.SubChainID),
  };

  const results = await Promise.all(
    lines.map((line: any) => mapToStore({ ...context, ...line }))
  );
  return results;
}

// Format 5: <root><SubChains><SubChainsXMLObject><SubChain>
async function parseRootSubChains(json: any): Promise<Store[] | null> {
  const root = json.root;
  const subchains = root?.SubChains?.SubChainsXMLObject?.SubChain;
  if (!subchains) return null;

  const cid = root.ChainId || root.ChainID;
  const cname = root.ChainName;

  const arr = ensureArray(subchains);
  const storeData: any[] = [];

  for (const sc of arr) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;

    const storeBlock = sc.Stores?.SubChainStoresXMLObject?.Store;
    if (!storeBlock) continue;

    const items = ensureArray(storeBlock.SubChainStoreXMLObject);

    for (const it of items) {
      storeData.push({
        ...it,
        ChainId: cid,
        SubChainId: scid,
        ChainName: cname,
        SubChainName: scname,
      });
    }
  }

  const results = await Promise.all(storeData.map(mapToStore));
  return results;
}

// Format 6: <Root><SubChains><SubChain><Stores><Store>
async function parseRootUppercaseSubChains(json: any): Promise<Store[] | null> {
  const root = json.Root;
  const subchains = root?.SubChains?.SubChain;
  if (!subchains) return null;

  const cid = root.ChainId || root.ChainID;
  const cname = root.ChainName;

  const arr = ensureArray(subchains);
  const storeData: any[] = [];

  for (const sc of arr) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;

    const lst = ensureArray(sc.Stores?.Store);
    for (const s of lst) {
      storeData.push({
        ...s,
        ChainId: cid,
        SubChainId: scid,
        ChainName: cname,
        SubChainName: scname,
      });
    }
  }

  const results = await Promise.all(storeData.map(mapToStore));
  return results;
}
