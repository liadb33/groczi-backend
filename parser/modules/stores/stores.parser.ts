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
    console.error("Error parsing stores XML:", filePath);
    return [];
  }

  // 1) נסיון ראשון: פורמט ASX – הפונקציה אסינכרונית
  const asx = await parseAsxValues(json);
  if (asx) {
    return asx;
  }

  // 2) פורמט Branches
  const branches = await parseStoreBranches(json);
  if (branches) {
    return branches;
  }

  // 3) פורמט root/row
  const rootRow = await parseRootRow(json);
  if (rootRow) {
    return rootRow;
  }

  // 4) פורמט OrderXml
  const order = await parseOrderXml(json);
  if (order) {
    return order;
  }

  // 5) פורמט SubChains תחת root
  const sub1 = await parseRootSubChains(json);
  if (sub1) {
    return sub1;
  }

  // 6) פורמט SubChains תחת Root (uppercase)
  const sub2 = await parseRootUppercaseSubChains(json);
  if (sub2) {
    return sub2;
  }

  // 7) אף פורמט לא זיהה – לוג ו־fallback
  return logUnrecognizedFormat(filePath, "stores.parser.ts");
}

export async function parseAsxValues(json: any): Promise<Store[] | null> {
  const rawList = json["asx:abap"]?.["asx:values"]?.STORES?.STORE;
  if (!rawList) return null;

  const chainId = json["asx:abap"]?.["asx:values"]?.CHAINID;

  // יוצר מערך של Promises
  const promises: Promise<Store>[] = rawList.map((store: Store) =>
    mapToStore({ ...store, CHAINID: chainId })
  );

  // ממתין שכולם יתרחשו ומחזיר כבר Store[]
  const stores: Store[] = await Promise.all(promises);
  return stores;
}

// Format 2: <Store><Branches><Branch>
export async function parseStoreBranches(json: any): Promise<Store[] | null> {
  const branches = json.Store?.Branches?.Branch;
  if (!branches) return null;

  const list = ensureArray(branches);
  // יוצרים מערך של Promises<Store>
  const promises = list.map((branch: any) => mapToStore(branch));
  // ממתינים לכולם ומחזירים Store[]
  return await Promise.all(promises);
}

// Format 3: <root><row><_Root_> with inline XML as string content
function fixHebrewEncoding(text: string): string {
  return Buffer.from(text, "latin1").toString("utf8");
}

export async function parseRootRow(json: any): Promise<Store[] | null> {
  const rows = json.root?.row;
  if (!Array.isArray(rows)) return null;

  const raws: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  let currentChainId = "",
    currentSubChainId = "";

  for (const row of rows) {
    const raw = row._Root_;
    if (!raw) continue;
    const decoded = fixHebrewEncoding(he.decode(raw));

    if (decoded.includes("</Store>")) {
      current["ChainId"] ||= currentChainId;
      current["SubChainId"] ||= currentSubChainId;
      if (current["StoreId"] && current["ChainId"] && current["SubChainId"]) {
        raws.push({ ...current });
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

  // עכשיו mapToStore על raws
  const promises = raws.map((r) => mapToStore(r));
  return await Promise.all(promises);
}

// Format 4: <OrderXml><Envelope><Header><Details><Line>
export async function parseOrderXml(json: any): Promise<Store[] | null> {
  const env = json.OrderXml?.Envelope;
  if (!env?.Header?.Details?.Line) return null;
  const lines = ensureArray(env.Header.Details.Line);

  const context = {
    ChainId: String(env.ChainId) || String(env.ChainID),
    SubChainId: String(env.SubChainId) || String(env.SubChainID),
  };

  const promises = lines.map((line: any) =>
    mapToStore({ ...context, ...line })
  );
  return await Promise.all(promises);
}

// Format 5: <root><SubChains><SubChainsXMLObject><SubChain>
export async function parseRootSubChains(json: any): Promise<Store[] | null> {
  const root = json.root;
  const subchains = root?.SubChains?.SubChainsXMLObject?.SubChain;
  if (!subchains) return null;

  const cid = root.ChainId || root.ChainID;
  const cname = root.ChainName;

  const arr = ensureArray(subchains);
  const raws: Record<string, any>[] = [];
  for (const sc of arr) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;
    const storeBlock = sc.Stores?.SubChainStoresXMLObject?.Store;
    if (!storeBlock) continue;
    for (const it of ensureArray(storeBlock.SubChainStoreXMLObject)) {
      raws.push({
        ...it,
        ChainId: cid,
        SubChainId: scid,
        ChainName: cname,
        SubChainName: scname,
      });
    }
  }
  return await Promise.all(raws.map((r) => mapToStore(r)));
}

// Format 6: <Root><SubChains><SubChain><Stores><Store>
export async function parseRootUppercaseSubChains(
  json: any
): Promise<Store[] | null> {
  const root = json.Root;
  const subchains = root?.SubChains?.SubChain;
  if (!subchains) return null;

  const cid = root.ChainId || root.ChainID;
  const cname = root.ChainName;

  // 1. בונים מערך של אובייקטים "גולמיים" עם כל השדות
  const raws: Record<string, any>[] = [];
  for (const sc of ensureArray(subchains)) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;
    for (const s of ensureArray(sc.Stores?.Store)) {
      raws.push({
        ...s,
        ChainId: cid,
        SubChainId: scid,
        ChainName: cname,
        SubChainName: scname,
      });
    }
  }

  // 2. ממפים ל-Promise<Store> באמצעות mapToStore
  const promises: Promise<Store>[] = raws.map((r) => mapToStore(r));

  // 3. ממתינים לכולם ומחזירים Store[]
  return await Promise.all(promises);
}
