import { normalizeKeys, normalizeKeys2 } from "../../utils/general.utils.js";
import { handleLocation } from "../../utils/location.utils.js";
import { Store } from "./store.entity.js";

export type GeocodeResult = {
  address: string;
  city: string | null;
  lat: number;
  lon: number;
  zipcode: string | null;
  storename: string;
};

export async function mapToStore(input: Record<string, any>): Promise<Store> {
  const data = normalizeKeys2(input);
  const location = await handleLocation(data);

  const store: Store = {
    ChainId: String(data["chainid"] ?? "").trim(),
    SubChainId: String(data["subchainid"] ?? "").trim(),
    StoreId: String(data["storeid"] ?? "").trim(),
    StoreType: data["storetype"] ? Number(data["storetype"]) : undefined,
    StoreName: location?.storename,
    Address: location?.address,
    City: location?.city,
    ZipCode: location?.zipcode,
    ChainName: data["chainname"] ? String(data["chainname"]).trim() : undefined,
    SubChainName: data["subchainname"]
      ? String(data["subchainname"]).trim()
      : undefined,
    Lat: location?.lat,
    Lon: location?.lon,
  };

  if (!store.SubChainName || /^\d+$/.test(store.SubChainName)) {
    store.SubChainName = store.ChainName;
  }

  return store;
}
