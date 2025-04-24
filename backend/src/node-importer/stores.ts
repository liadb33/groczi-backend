import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { XMLParser } from "fast-xml-parser";

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

const parser = new XMLParser({ ignoreAttributes: false });

async function parseStoreXmlFile(filePath: string): Promise<StoreData[]> {
  const xmlContent = await fs.readFile(filePath, "utf-8");
  const json = parser.parse(xmlContent);
  const stores: StoreData[] = [];

  // סוג 1: <asx:abap><asx:values>
  const asxStores = json?.["asx:abap"]?.["asx:values"]?.STORES?.STORE;
  if (asxStores) {
    const storeList = Array.isArray(asxStores) ? asxStores : [asxStores];
    return storeList.map((store) => ({
      ChainId: json["asx:abap"]["asx:values"].CHAINID,
      SubChainId: store.SUBCHAINID,
      StoreId: store.STOREID,
      StoreName: store.STORENAME,
      Address: store.ADDRESS,
      City: store.CITY,
      ZipCode: store.ZIPCODE,
      BikoretNo: store.BIKORETNO,
      StoreType: store.STORETYPE,
      ChainName: store.CHAINNAME,
      SubChainName: store.SUBCHAINNAME,
    }));
  }

  // סוג 2: <Store><Branches><Branch>
  const branches = json?.Store?.Branches?.Branch;
  if (branches) {
    const branchList = Array.isArray(branches) ? branches : [branches];
    return branchList.map((branch) => ({
      ChainId: branch.ChainID,
      SubChainId: branch.SubChainID,
      StoreId: branch.StoreID,
      StoreName: branch.StoreName,
      Address: branch.Address,
      City: branch.City,
      ZipCode: branch.ZIPCode,
      BikoretNo: branch.BikoretNo,
      StoreType: branch.StoreType,
      ChainName: branch.ChainName,
      SubChainName: branch.SubChainName,
    }));
  }

  // סוג 3: <root><row><_Root_>
  const rows = json?.root?.row;
  if (rows && Array.isArray(rows)) {
    let currentStore: Partial<StoreData> = {};
    for (const row of rows) {
      const raw = row._Root_;
      if (!raw) continue;

      const matches = raw.matchAll(/<(\w+)>(.*?)<\/\1>/g);
      for (const [, key, value] of matches) {
        if (key === "StoreId" && Object.keys(currentStore).length > 0) {
          stores.push(currentStore as StoreData);
          currentStore = {};
        }

        switch (key) {
          case "StoreId":
            currentStore.StoreId = value;
            break;
          case "StoreName":
            currentStore.StoreName = value;
            break;
          case "Address":
            currentStore.Address = value;
            break;
          case "City":
            currentStore.City = value;
            break;
          case "ZipCode":
            currentStore.ZipCode = value;
            break;
          case "BikoretNo":
            currentStore.BikoretNo = value;
            break;
          case "StoreType":
            currentStore.StoreType = value;
            break;
        }
      }
    }

    if (Object.keys(currentStore).length > 0) {
      stores.push(currentStore as StoreData);
    }

    return stores;
  }

  const subChains = json?.Root?.SubChains?.SubChain;
  if (subChains) {
    const chainId = (json.Root.ChainId || json.Root.ChainID || "")
      .toString()
      .toLowerCase();
    const chainName = (json.Root.ChainName || "").toString().toLowerCase();

    const subChainList = Array.isArray(subChains) ? subChains : [subChains];
    for (const subChain of subChainList) {
      const subChainId = (subChain.SubChainId || subChain.SubChainID || "")
        .toString()
        .toLowerCase();
      const subChainName = (subChain.SubChainName || "")
        .toString()
        .toLowerCase();

      const storeList = Array.isArray(subChain.Stores?.Store)
        ? subChain.Stores.Store
        : [subChain.Stores?.Store].filter(Boolean);

      for (const store of storeList) {
        const toLower = (val: any) =>
          typeof val === "string"
            ? val.toLowerCase()
            : val?.toString()?.toLowerCase() || "";

        stores.push({
          ChainId: chainId,
          SubChainId: subChainId,
          StoreId: toLower(store.StoreId || store.StoreID),
          StoreName: toLower(store.StoreName),
          Address: toLower(store.Address),
          City: toLower(store.City),
          ZipCode: toLower(store.ZipCode || store.ZIPCode),
          BikoretNo: toLower(store.BikoretNo),
          StoreType: toLower(store.StoreType),
          ChainName: chainName,
          SubChainName: subChainName,
        });
      }
    }

    return stores;
  }

  console.warn(`⚠️ פורמט לא מזוהה: ${filePath}`);
  return [];
}

async function run() {
  const basePath = path.join(__dirname, "..", "..", "files");
  const entries = await fs.readdir(basePath);
  const xmlFiles = entries.filter((file) => file.endsWith(".xml"));

  for (const file of xmlFiles) {
    const fullPath = path.join(basePath, file);
    console.log(`📄 Parsing ${file}`);
    const stores = await parseStoreXmlFile(fullPath);
    console.log(`✅ Found ${stores.length} stores`);
    console.table(stores.slice(0, 3));
  }
}

run().catch(console.error);
