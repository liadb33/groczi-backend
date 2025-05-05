import { Store } from "./store.entity.js";
import { createParser, parseXmlFile, readFileWithEncoding } from "../../utils/xml-parser.utils.js";

const storeKeys: (keyof Store)[] = [
  "ChainId",
  "SubChainId",
  "StoreId",
  "StoreName",
  "Address",
  "City",
  "ZipCode",
  "StoreType",
  "ChainName",
  "SubChainName",
];

const numberKeys: (keyof Store)[] = [
  "ChainId",
  "SubChainId",
  "StoreId",
  "StoreType",
];

const parser = createParser("stores");

export function mapToStore(input: Record<string, any>): Store {
  const result: Partial<Store> = {};

  for (const key of storeKeys) {
    const rawKey = key as string;
    let value =
      input[rawKey] ??
      input[rawKey.toUpperCase?.()] ??
      input[rawKey.toLowerCase?.()] ??
      0;

    if (numberKeys.includes(key)) {
      const num = parseInt(value);
      if (!isNaN(num)) {
        result[key as keyof Store] = num as any;
      }
    } else {
      result[key as keyof Store] = String(value).trim() as any;
    }
  }
  const scn = result.SubChainName?.trim() ?? "";
  if (!scn || /^\d+$/.test(scn)) {
    result.SubChainName = result.ChainName;
  }

  return result as Store;
}

export async function parseStoreXmlFile(filePath: string): Promise<Store[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) return [];

  // סוג 1: <asx:abap><asx:values>
  if (json["asx:abap"]?.["asx:values"]?.STORES?.STORE) {
    const stores = json["asx:abap"]["asx:values"].STORES.STORE;
    const list = Array.isArray(stores) ? stores : [stores];
    return list.map(mapToStore);
  }

  // סוג 2: <Store><Branches><Branch>
  if (json.Store?.Branches?.Branch) {
    const branches = Array.isArray(json.Store.Branches.Branch)
      ? json.Store.Branches.Branch
      : [json.Store.Branches.Branch];
    return branches.map(mapToStore);
  }

  // סוג 3: <root><row><_Root_>
  if (json.root?.row && Array.isArray(json.root.row)) {
    const stores: Store[] = [];
    let current: Record<string, string> = {};
    for (const row of json.root.row) {
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

  // סוג 4: <OrderXml>
  if (json.OrderXml?.Envelope) {
    const env = json.OrderXml.Envelope;
    const lines = Array.isArray(env.Header.Details.Line)
      ? env.Header.Details.Line
      : [env.Header.Details.Line];

    const context = {
      ChainId: env.ChainId || env.ChainID,
      SubChainId: env.SubChainId || env.SubChainID,
    };

    return lines.map((line: any) => mapToStore({ ...context, ...line }));
  }

  // סוג 5: <root><SubChains>
  if (json.root?.SubChains?.SubChainsXMLObject?.SubChain) {
    const root = json.root;
    const cid = root.ChainId || root.ChainID;
    const cname = root.ChainName;

    const subArr = Array.isArray(root.SubChains.SubChainsXMLObject.SubChain)
      ? root.SubChains.SubChainsXMLObject.SubChain
      : [root.SubChains.SubChainsXMLObject.SubChain];

    const stores: Store[] = [];

    for (const sc of subArr) {
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

  // סוג 6: <Root><SubChains>
  if (json.Root?.SubChains) {
    const root = json.Root;
    const cid = root.ChainId || root.ChainID;
    const cname = root.ChainName;

    const arr = Array.isArray(root.SubChains.SubChain)
      ? root.SubChains.SubChain
      : [root.SubChains.SubChain];

    const stores: Store[] = [];

    for (const sc of arr) {
      const scid = sc.SubChainId || sc.SubChainID;
      const scn = sc.SubChainName;

      if (!sc.Stores?.Store) continue;

      const lst = Array.isArray(sc.Stores.Store)
        ? sc.Stores.Store
        : [sc.Stores.Store];

      for (const s of lst) {
        stores.push(
          mapToStore({
            ...s,
            ChainId: cid,
            SubChainId: scid,
            ChainName: cname,
            SubChainName: scn,
          })
        );
      }
    }
    return stores;
  }

  console.log("No stores found in:", filePath,"check the file format");
  return [];
}
