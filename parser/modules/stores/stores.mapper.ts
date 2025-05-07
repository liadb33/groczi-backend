import { Store } from "./store.entity.js";

export function mapToStore(input: Record<string, any>): Store {
  const store: Store = {
    ChainId: String(
      input.ChainId || input.CHAINID || input.chainid || ""
    ).trim(),
    SubChainId: String(
      input.SubChainId || input.SUBCHAINID || input.subchainid || ""
    ).trim(),
    StoreId: String(
      input.StoreId || input.STOREID || input.storeid || ""
    ).trim(),
    StoreType: input.StoreType ? Number(input.StoreType) : undefined,
    StoreName: input.StoreName ? String(input.StoreName).trim() : undefined,
    Address: input.Address ? String(input.Address).trim() : undefined,
    City: input.City ? String(input.City).trim() : undefined,
    ZipCode: input.ZipCode ? String(input.ZipCode).trim() : undefined,
    ChainName: input.ChainName ? String(input.ChainName).trim() : undefined,
    SubChainName: input.SubChainName
      ? String(input.SubChainName).trim()
      : undefined,
  };

  if (!store.SubChainName || /^\d+$/.test(store.SubChainName)) {
    store.SubChainName = store.ChainName;
  }

  return store;
}
