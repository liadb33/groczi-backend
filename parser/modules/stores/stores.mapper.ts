import { fetchCoordinates } from "../../utils/google.utils.js";
import { normalizeKeys } from "../../utils/general.utils.js";
import { Store } from "./store.entity.js";

export async function mapToStore(input: Record<string, any>): Promise<Store> {
  const data = normalizeKeys(input);
  
  if(data["zipcode"] && data["zipcode"].length > 10) {
    data["zipcode"] = undefined;
  }
  const store: Store = {
    ChainId: String(data["chainid"] ?? "").trim(),
    SubChainId: String(data["subchainid"] ?? "").trim(),
    StoreId: String(data["storeid"] ?? "").trim(),
    StoreType: data["storetype"] ? Number(data["storetype"]) : undefined,
    StoreName: data["storename"] ? String(data["storename"]).trim() : undefined,
    Address: data["address"] ? String(data["address"]).trim() : undefined,
    City: data["city"] ? String(data["city"]).trim() : undefined,
    ZipCode:
      !data["zipcode"] || String(data["zipcode"]).toLowerCase() === "unknown"
        ? undefined
        : String(data["zipcode"]).trim(),
    ChainName: data["chainname"] ? String(data["chainname"]).trim() : undefined,
    SubChainName: data["subchainname"]
      ? String(data["subchainname"]).trim()
      : undefined,
  };

  if (!store.SubChainName || /^\d+$/.test(store.SubChainName)) {
    store.SubChainName = store.ChainName;
  }

  //Geocode the store address to get coordinates
  if (store.Address) {
    const addressQuery = `${store.StoreName ? store.StoreName + ', ' : ''}${store.Address}`;
    console.log(`🌐 Geocoding: ${addressQuery}`);
    
    try {
      const coordinates = await fetchCoordinates(addressQuery);
      if (coordinates) {
        store.Latitude = coordinates.lat;
        store.Longitude = coordinates.lng;
        console.log(`✅ Geocoded: ${addressQuery} -> (${store.Latitude}, ${store.Longitude})`);
      } else {
        console.warn(`⚠️ No coordinates found for: ${addressQuery}`);
      }
    } catch (error) {
      console.error(`❌ Geocoding failed for: ${addressQuery}`, error);
    }
  }

  return store;
}
