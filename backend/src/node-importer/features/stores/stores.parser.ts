import { XMLParser } from "fast-xml-parser";
import { Store } from "./store.entity.js";
import { readFileWithEncoding } from "../utils/encoding.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (jpath: string) => {
    const arrayPaths = [
      "Root.SubChains.SubChain",
      "SubChain.Stores.Store",
      "asx:values.STORES.STORE",
      "Store.Branches.Branch",
      "root.row",
    ];
    return arrayPaths.includes(jpath);
  },
});

export async function parseStoreXmlFile(filePath: string): Promise<Store[]> {
  const xmlContent = await readFileWithEncoding(filePath);
  const cleanXml =
    xmlContent.charCodeAt(0) === 0xfeff ? xmlContent.slice(1) : xmlContent;
  const json = parser.parse(cleanXml);
  if (!json) return [];

  // סוג 1: <asx:abap><asx:values>
  if (json["asx:abap"]?.["asx:values"]?.STORES?.STORE) {
    const stores = json["asx:abap"]["asx:values"].STORES.STORE;
    const list = Array.isArray(stores) ? stores : [stores];
    return list.map((s) => ({
      ChainId: json["asx:abap"]["asx:values"].CHAINID,
      SubChainId: s.SUBCHAINID ?? undefined,
      StoreId: s.STOREID,
      StoreName: s.STORENAME || undefined,
      Address: s.ADDRESS || undefined,
      City: String(s.CITY) || undefined,
      ZipCode: String(s.ZIPCODE) || undefined,
      BikoretNo: s.BIKORETNO,
      StoreType: s.STORETYPE ? parseInt(s.STORETYPE) : undefined,
      ChainName: s.CHAINNAME || undefined,
      SubChainName: String(s.SUBCHAINNAME) || undefined,
    }));
  }

  // סוג 2: <Store><Branches><Branch>
  if (json.Store?.Branches?.Branch) {
    const branches = json.Store.Branches.Branch;
    const list = Array.isArray(branches) ? branches : [branches];
    return list.map((b) => ({
      ChainId: b.ChainID,
      SubChainId: b.SubChainID ?? undefined,
      StoreId: b.StoreID,
      StoreName: b.StoreName || undefined,
      Address: b.Address || undefined,
      City: String(b.City) || undefined,
      ZipCode: String(b.ZIPCode) || undefined,
      BikoretNo: b.BikoretNo,
      StoreType: b.StoreType ? parseInt(b.StoreType) : undefined,
      ChainName: b.ChainName || undefined,
      SubChainName: String(b.SubChainName) || undefined,
    }));
  }

  // סוג 3: <root><row><_Root_>
  if (json.root?.row && Array.isArray(json.root.row)) {
    const stores: Store[] = [];
    let current: Partial<Store> = {};
    for (const row of json.root.row) {
      const raw = row._Root_;
      if (!raw) continue;
      for (const [, key, value] of raw.matchAll(/<(\w+)>(.*?)<\/\1>/g)) {
        if (key === "StoreId" && Object.keys(current).length) {
          stores.push(current as Store);
          current = {};
        }
        switch (key) {
          case "StoreId":
            current.StoreId = value;
            break;
          case "StoreName":
            current.StoreName = value || undefined;
            break;
          case "Address":
            current.Address = value || undefined;
            break;
          case "City":
            current.City = String(value) || undefined;
            break;
          case "ZipCode":
            current.ZipCode = String(value) || undefined;
            break;
          case "BikoretNo":
            current.BikoretNo = value;
            break;
          case "StoreType":
            current.StoreType = value ? parseInt(value) : undefined;
            break;
        }
      }
    }
    if (Object.keys(current).length) stores.push(current as Store);
    return stores;
  }

  // סוג 5: <OrderXml>
  if (json.OrderXml?.Envelope) {
    const env = json.OrderXml.Envelope;
    const lines = Array.isArray(env.Header.Details.Line)
      ? env.Header.Details.Line
      : [env.Header.Details.Line];
    const cid = env.ChainId || env.ChainID || undefined;
    const sid = env.SubChainId || env.SubChainID || undefined;
    return lines.map((l: any) => ({
      ChainId: cid,
      SubChainId: sid ?? undefined,
      StoreId: l.StoreId || l.StoreID || undefined,
      StoreName: l.StoreName || undefined,
      Address: l.Address || undefined,
      City: String(l.City) || undefined,
      ZipCode: String(l.ZipCode) || String(l.ZIPCode) || undefined,
      BikoretNo: l.BikoretNo || undefined,
      StoreType: l.StoreType ? parseInt(l.StoreType) : undefined,
      ChainName: l.ChainName || undefined,
      SubChainName: String(l.SubChainName) || undefined,
    }));
  }

  // סוג 6: <root><SubChains>
  if (json.root?.SubChains?.SubChainsXMLObject?.SubChain) {
    const root = json.root;
    const cid = root.ChainId || root.ChainID || undefined;
    const cname = root.ChainName || undefined;
    const subArr = Array.isArray(root.SubChains.SubChainsXMLObject.SubChain)
      ? root.SubChains.SubChainsXMLObject.SubChain
      : [root.SubChains.SubChainsXMLObject.SubChain];
    const stores: Store[] = [];
    for (const sc of subArr) {
      const scid = sc.SubChainId || sc.SubChainID || undefined;
      const scname = sc.SubChainName || undefined;
      const storeBlock = sc.Stores?.SubChainStoresXMLObject?.Store;
      if (!storeBlock) continue;
      const items = Array.isArray(storeBlock.SubChainStoreXMLObject)
        ? storeBlock.SubChainStoreXMLObject
        : [storeBlock.SubChainStoreXMLObject];
      for (const it of items) {
        stores.push({
          ChainId: cid,
          SubChainId: scid ?? undefined,
          StoreId: it.StoreId,
          StoreName: it.StoreName || undefined,
          Address: it.Address || undefined,
          City: String(it.City) || undefined,
          ZipCode: String(it.ZipCode) || undefined,
          BikoretNo: it.BikoretNo,
          StoreType: it.StoreType ? parseInt(it.StoreType) : undefined,
          ChainName: cname || undefined,
          SubChainName: String(scname) || undefined,
        });
      }
    }
    return stores;
  }

  if (json.Root?.SubChains) {
    const root = json.Root;
    const cid = root.ChainId || root.ChainID || undefined;
    const cname = root.ChainName || undefined;
    const arr = Array.isArray(root.SubChains.SubChain)
      ? root.SubChains.SubChain
      : [root.SubChains.SubChain];
    const stores: Store[] = [];
    for (const sc of arr) {
      if (!sc.Stores?.Store) continue;
      const scid = sc.SubChainId || sc.SubChainID || undefined;
      const scn = sc.SubChainName || undefined;
      const lst = Array.isArray(sc.Stores.Store)
        ? sc.Stores.Store
        : [sc.Stores.Store];
      for (const s of lst) {
        stores.push({
          ChainId: cid,
          SubChainId: scid ?? undefined,
          StoreId: s.StoreId || s.StoreID || undefined,
          StoreName: s.StoreName || undefined,
          Address: s.Address || undefined,
          City: String(s.City) || undefined,
          ZipCode: String(s.ZipCode) || String(s.ZIPCode) || undefined,
          BikoretNo: s.BikoretNo || undefined,
          StoreType: s.StoreType ? parseInt(s.StoreType) : undefined,
          ChainName: cname || undefined,
          SubChainName: String(scn) || undefined,
        });
      }
    }
    return stores;
  }

  return [];
}
