import { normalizeKeys } from "../../utils/general.utils.js";
import { Store } from "./store.entity.js";

export function mapToStore(input: Record<string, any>): Store {
  const data = normalizeKeys(input);

  const store: Store = {
    ChainId: String(data["chainid"] ?? "").trim(),
    SubChainId: String(data["subchainid"] ?? "").trim(),
    StoreId: String(data["storeid"] ?? "").trim(),
    StoreType: data["storetype"] ? Number(data["storetype"]) : undefined,
    StoreName: data["storename"] ? String(data["storename"]).trim() : undefined,
    Address: data["address"] ? String(data["address"]).trim() : undefined,
    City: data["city"] ? String(data["city"]).trim() : undefined,
    ZipCode: data["zipcode"] ? String(data["zipcode"]).trim() : undefined,
    ChainName: data["chainname"] ? String(data["chainname"]).trim() : undefined,
    SubChainName: data["subchainname"]
      ? String(data["subchainname"]).trim()
      : undefined,
  };

  if (!store.SubChainName || /^\d+$/.test(store.SubChainName)) {
    store.SubChainName = store.ChainName;
  }

  return store;
}
