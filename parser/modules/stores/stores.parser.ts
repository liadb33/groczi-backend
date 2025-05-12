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
    parseAsxValues(json) ??
    parseStoreBranches(json) ??
    parseRootRow(json) ??
    parseOrderXml(json) ??
    parseRootSubChains(json) ??
    parseRootUppercaseSubChains(json) ??
    logUnrecognizedFormat(filePath, "stores.parser.ts")
  );
}

// Format 1: <asx:abap><asx:values><STORES><STORE>
function parseAsxValues(json: any): Store[] | null {
  const stores = json["asx:abap"]?.["asx:values"]?.STORES?.STORE;
  if (!stores) return null;
  const chainId = json["asx:abap"]?.["asx:values"]?.CHAINID;

  const list = ensureArray(stores);

  return list.map((store) => mapToStore({ ...store, CHAINID: chainId }));
}

// Format 2: <Store><Branches><Branch>
function parseStoreBranches(json: any): Store[] | null {
  const branches = json.Store?.Branches?.Branch;
  if (!branches) return null;
  const list = ensureArray(branches);
  return list.map(mapToStore);
}

// Format 3: <root><row><_Root_> with inline XML as string content
function fixHebrewEncoding(text: string): string {
  return Buffer.from(text, "latin1").toString("utf8");
}

function parseRootRow(json: any): Store[] | null {
  const rows = json.root?.row;
  if (!Array.isArray(rows)) return null;

  const stores: Store[] = [];
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
        stores.push(mapToStore(current));
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

  return stores;
}

// Format 4: <OrderXml><Envelope><Header><Details><Line>
function parseOrderXml(json: any): Store[] | null {
  const env = json.OrderXml?.Envelope;
  if (!env?.Header?.Details?.Line) return null;
  const lines = ensureArray(env.Header.Details.Line);

  const context = {
    ChainId: String(env.ChainId) || String(env.ChainID),
    SubChainId: String(env.SubChainId) || String(env.SubChainID),
  };

  return lines.map((line: any) => mapToStore({ ...context, ...line }));
}

// Format 5: <root><SubChains><SubChainsXMLObject><SubChain>
function parseRootSubChains(json: any): Store[] | null {
  const root = json.root;
  const subchains = root?.SubChains?.SubChainsXMLObject?.SubChain;
  if (!subchains) return null;

  const cid = root.ChainId || root.ChainID;
  const cname = root.ChainName;

  const arr = ensureArray(subchains);
  const stores: Store[] = [];

  for (const sc of arr) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;

    const storeBlock = sc.Stores?.SubChainStoresXMLObject?.Store;
    if (!storeBlock) continue;

    const items = ensureArray(storeBlock.SubChainStoreXMLObject);

    for (const it of items) {
      stores.push(
        mapToStore({
          ...it,
          ChainId: cid,
          SubChainId: scid,
          ChainName: cname,
          SubChainName: scname,
        })
      );
    }
  }

  return stores;
}

// Format 6: <Root><SubChains><SubChain><Stores><Store>
function parseRootUppercaseSubChains(json: any): Store[] | null {
  const root = json.Root;
  const subchains = root?.SubChains?.SubChain;
  if (!subchains) return null;

  const cid = root.ChainId || root.ChainID;
  const cname = root.ChainName;

  const arr = ensureArray(subchains);
  const stores: Store[] = [];

  for (const sc of arr) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;

    const lst = ensureArray(sc.Stores?.Store);
    for (const s of lst) {
      stores.push(
        mapToStore({
          ...s,
          ChainId: cid,
          SubChainId: scid,
          ChainName: cname,
          SubChainName: scname,
        })
      );
    }
  }

  return stores;
}
