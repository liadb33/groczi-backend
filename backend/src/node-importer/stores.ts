import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { XMLParser } from "fast-xml-parser";
import iconv from "iconv-lite";
import jschardet from "jschardet";

// ✅ פתרון לבעיה של __dirname ב-ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StoreData {
  ChainId?: string;
  SubChainId?: string;
  StoreId: string;
  StoreName: string;
  Address: string;
  City: string;
  ZipCode: string;
  BikoretNo?: string;
  StoreType?: string;
  ChainName?: string;
  SubChainName?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name, jpath) => {
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

// Helper function to detect and convert file encoding
async function readFileWithEncoding(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const detected = jschardet.detect(buffer);
  const encoding = detected.encoding || "utf-8";
  if (encoding.startsWith("UTF-16")) {
    return iconv.decode(buffer, encoding);
  }
  return buffer.toString("utf-8");
}

async function parseStoreXmlFile(filePath: string): Promise<StoreData[]> {
  const xmlContent = await readFileWithEncoding(filePath);
  const cleanXml =
    xmlContent.charCodeAt(0) === 0xfeff ? xmlContent.slice(1) : xmlContent;
  const json = parser.parse(cleanXml);

  // סוג 1: <asx:abap><asx:values>
  if (json?.["asx:abap"]?.["asx:values"]?.STORES?.STORE) {
    const stores = json["asx:abap"]["asx:values"].STORES.STORE;
    const list = Array.isArray(stores) ? stores : [stores];
    return list.map((s) => ({
      ChainId: json["asx:abap"]["asx:values"].CHAINID,
      SubChainId: s.SUBCHAINID,
      StoreId: s.STOREID,
      StoreName: s.STORENAME,
      Address: s.ADDRESS,
      City: s.CITY,
      ZipCode: s.ZIPCODE,
      BikoretNo: s.BIKORETNO,
      StoreType: s.STORETYPE,
      ChainName: s.CHAINNAME,
      SubChainName: s.SUBCHAINNAME,
    }));
  }

  // סוג 2: <Store><Branches><Branch>
  if (json?.Store?.Branches?.Branch) {
    const branches = json.Store.Branches.Branch;
    const list = Array.isArray(branches) ? branches : [branches];
    return list.map((b) => ({
      ChainId: b.ChainID,
      SubChainId: b.SubChainID,
      StoreId: b.StoreID,
      StoreName: b.StoreName,
      Address: b.Address,
      City: b.City,
      ZipCode: b.ZIPCode,
      BikoretNo: b.BikoretNo,
      StoreType: b.StoreType,
      ChainName: b.ChainName,
      SubChainName: b.SubChainName,
    }));
  }

  // סוג 3: <root><row><_Root_>
  if (json?.root?.row && Array.isArray(json.root.row)) {
    const stores: StoreData[] = [];
    let current: Partial<StoreData> = {};
    for (const row of json.root.row) {
      const raw = row._Root_;
      if (!raw) continue;
      for (const [, key, value] of raw.matchAll(/<(\w+)>(.*?)<\/\1>/g)) {
        if (key === "StoreId" && Object.keys(current).length) {
          stores.push(current as StoreData);
          current = {};
        }
        switch (key) {
          case "StoreId":
            current.StoreId = value;
            break;
          case "StoreName":
            current.StoreName = value;
            break;
          case "Address":
            current.Address = value;
            break;
          case "City":
            current.City = value;
            break;
          case "ZipCode":
            current.ZipCode = value;
            break;
          case "BikoretNo":
            current.BikoretNo = value;
            break;
          case "StoreType":
            current.StoreType = value;
            break;
        }
      }
    }
    if (Object.keys(current).length) stores.push(current as StoreData);
    return stores;
  }

  // סוג 5: <OrderXml>
  if (json?.OrderXml?.Envelope) {
    const env = json.OrderXml.Envelope;
    const lines = Array.isArray(env.Header.Details.Line)
      ? env.Header.Details.Line
      : [env.Header.Details.Line];
    const cid = env.ChainId || env.ChainID || "";
    const sid = env.SubChainId || env.SubChainID || "";
    return lines.map((l: any) => ({
      ChainId: cid,
      SubChainId: sid,
      StoreId: l.StoreId || l.StoreID || "",
      StoreName: l.StoreName || "",
      Address: l.Address || "",
      City: l.City || "",
      ZipCode: l.ZipCode || l.ZIPCode || "",
      BikoretNo: l.BikoretNo || "",
      StoreType: l.StoreType || "",
      ChainName: l.ChainName || "",
      SubChainName: l.SubChainName || "",
    }));
  }

  // סוג 6: <root><SubChains>
  if (json?.root?.SubChains?.SubChainsXMLObject?.SubChain) {
    const root = json.root;
    const cid = root.ChainId || root.ChainID || "";
    const cname = root.ChainName || "";
    const subArr = Array.isArray(root.SubChains.SubChainsXMLObject.SubChain)
      ? root.SubChains.SubChainsXMLObject.SubChain
      : [root.SubChains.SubChainsXMLObject.SubChain];
    const stores: StoreData[] = [];
    for (const sc of subArr) {
      const scid = sc.SubChainId || sc.SubChainID || "";
      const scname = sc.SubChainName || "";
      const storeBlock = sc.Stores?.SubChainStoresXMLObject?.Store;
      if (!storeBlock) continue;
      const items = Array.isArray(storeBlock.SubChainStoreXMLObject)
        ? storeBlock.SubChainStoreXMLObject
        : [storeBlock.SubChainStoreXMLObject];
      for (const it of items) {
        stores.push({
          ChainId: cid,
          SubChainId: scid,
          StoreId: it.StoreId,
          StoreName: it.StoreName,
          Address: it.Address,
          City: it.City,
          ZipCode: it.ZipCode,
          BikoretNo: it.BikoretNo,
          StoreType: it.StoreType,
          ChainName: cname,
          SubChainName: scname,
        });
      }
    }
    return stores;
  }

  // סוג 4: יוכננוף
  if (json?.Root?.SubChains) {
    const root = json.Root;
    const cid = root.ChainId || root.ChainID || "";
    const cname = root.ChainName || "";
    const arr = Array.isArray(root.SubChains.SubChain)
      ? root.SubChains.SubChain
      : [root.SubChains.SubChain];
    const stores: StoreData[] = [];
    for (const sc of arr) {
      if (!sc.Stores?.Store) continue;
      const scid = sc.SubChainId || sc.SubChainID || "";
      const scn = sc.SubChainName || "";
      const lst = Array.isArray(sc.Stores.Store)
        ? sc.Stores.Store
        : [sc.Stores.Store];
      for (const s of lst) {
        stores.push({
          ChainId: cid,
          SubChainId: scid,
          StoreId: s.StoreId || s.StoreID || "",
          StoreName: s.StoreName || "",
          Address: s.Address || "",
          City: s.City || "",
          ZipCode: s.ZipCode || s.ZIPCode || "",
          BikoretNo: s.BikoretNo || "",
          StoreType: s.StoreType || "",
          ChainName: cname,
          SubChainName: scn,
        });
      }
    }
    return stores;
  }

  return [];
}

async function run() {
  const basePath = path.join(__dirname, "..", "..", "files");
  const entries = await fs.readdir(basePath);
  const xmlFiles = entries.filter((f) => f.endsWith(".xml"));

  let total = 0;
  let success = 0;

  for (const file of xmlFiles) {
    const fullPath = path.join(basePath, file);
    const stores = await parseStoreXmlFile(fullPath);

    console.log(`📄 ${file}: ${stores.length} stores`);
    console.table(stores.slice(0, 3));

    if (stores.length) {
      success++;
      total += stores.length;
    }
  }

  console.log(
    `Processed ${success}/${xmlFiles.length} files, total ${total} stores`
  );
}

run().catch(console.error);
