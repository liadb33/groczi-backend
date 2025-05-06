import { logUnrecognizedFormat } from "../../utils/general.utils";
import { createParser, parseXmlFile } from "../../utils/xml-parser.utils";
import { Store } from "./store.entity";
import { mapToStore } from "./stores.mapper.js";

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
    logUnrecognizedFormat(filePath,"stores.parser.ts")
  );
}

// Format 1: <asx:abap><asx:values><STORES><STORE>
function parseAsxValues(json: any): Store[] | null {
  const stores = json["asx:abap"]?.["asx:values"]?.STORES?.STORE;
  if (!stores) return null;
  const list = Array.isArray(stores) ? stores : [stores];
  return list.map(mapToStore);
}

// Format 2: <Store><Branches><Branch>
function parseStoreBranches(json: any): Store[] | null {
  const branches = json.Store?.Branches?.Branch;
  if (!branches) return null;
  const list = Array.isArray(branches) ? branches : [branches];
  return list.map(mapToStore);
}

// Format 3: <root><row><_Root_> with inline XML as string content
function parseRootRow(json: any): Store[] | null {
  const rows = json.root?.row;
  if (!Array.isArray(rows)) return null;

  const stores: Store[] = [];
  let current: Record<string, string> = {};
  for (const row of rows) {
    const raw = row._Root_;
    if (!raw) continue;
    for (const [, key, value] of raw.matchAll(/<(\w+)>(.*?)<\/\1>/g)) {
      if (key.toLowerCase() === "storeid" && Object.keys(current).length) {
        stores.push(mapToStore(current));
        current = {};
      }
      current[key] = value;
    }
  }
  if (Object.keys(current).length) stores.push(mapToStore(current));
  return stores;
}

// Format 4: <OrderXml><Envelope><Header><Details><Line>
function parseOrderXml(json: any): Store[] | null {
  const env = json.OrderXml?.Envelope;
  if (!env?.Header?.Details?.Line) return null;

  const lines = Array.isArray(env.Header.Details.Line)
    ? env.Header.Details.Line
    : [env.Header.Details.Line];

  const context = {
    ChainId: env.ChainId || env.ChainID,
    SubChainId: env.SubChainId || env.SubChainID,
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

  const arr = Array.isArray(subchains) ? subchains : [subchains];
  const stores: Store[] = [];

  for (const sc of arr) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;

    const storeBlock = sc.Stores?.SubChainStoresXMLObject?.Store;
    if (!storeBlock) continue;

    const items = Array.isArray(storeBlock.SubChainStoreXMLObject)
      ? storeBlock.SubChainStoreXMLObject
      : [storeBlock.SubChainStoreXMLObject];

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

  const arr = Array.isArray(subchains) ? subchains : [subchains];
  const stores: Store[] = [];

  for (const sc of arr) {
    const scid = sc.SubChainId || sc.SubChainID;
    const scname = sc.SubChainName;

    const lst = Array.isArray(sc.Stores?.Store) ? sc.Stores.Store : [sc.Stores.Store];
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

