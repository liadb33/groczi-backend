import { fetchCoordinates } from "../../utils/google.utils.js";
import { getIdsFromRoot } from "../../utils/id-resolution.utils.js";
import { normalizeKeys, normalizeStoreKeys } from "../../utils/text-normalization.utils.js";
//import { fixStoreData } from "../../utils/openai.utils.js";
import { findStoreCoordinates } from "../../repositories/stores.repository.js";
import { Store } from "./store.entity.js";

export async function mapToStore(input: Record<string, any>): Promise<Store> {
  
  const normalizedInput = normalizeKeys(input);
  
  const data = normalizeStoreKeys(normalizedInput);
  
  const store: Store = {
    ChainId: String(data["chainid"] ?? "").trim(),
    SubChainId: String(data["subchainid"] ?? "").trim(),
    StoreId: String(data["storeid"] ?? "").trim(),
    StoreName: data["storename"] ? String(data["storename"]).trim() : undefined,
    Address: data["address"] ? String(data["address"]).trim() : undefined,
    City: data["city"] ? String(data["city"]).trim() : undefined,

    ChainName: data["chainname"] ? String(data["chainname"]).trim() : undefined,
    SubChainName: data["subchainname"]
      ? String(data["subchainname"]).trim()
      : undefined,
  };

  //open ai fixStoreData
  // const storeDataForAI = {
  //   storename: store.StoreName || "",
  //   address: store.Address || "",
  //   city: store.City || "",
  //   
  //   chainname: store.ChainName || "",
  //   subchainname: store.SubChainName || "",
  // };
  
  // const fixedStore = await fixStoreData(storeDataForAI);
  
  // // Apply the fixed data back to the store object
  // if (fixedStore) {
  //   store.StoreName = fixedStore.storename || store.StoreName;
  //   store.Address = fixedStore.address || store.Address;
  //   store.City = fixedStore.city || store.City;
  //  
  //   store.ChainName = fixedStore.chainname || store.ChainName;
  //   store.SubChainName = fixedStore.subchainname || store.SubChainName;
  // }


   //check here if store is already in the database and if it is return the lat ,lon
  try {
    const existingStore = await findStoreCoordinates({
      ChainId: store.ChainId,
      SubChainId: store.SubChainId,
      StoreId: store.StoreId,
    });

    if (existingStore && existingStore.Latitude && existingStore.Longitude) {
      // Store exists in database with coordinates, use them
      store.Latitude = existingStore.Latitude;
      store.Longitude = existingStore.Longitude;
    } else {
      // Store doesn't exist or doesn't have coordinates, geocode it
      if (store.Address) {
        const addressQuery = `${store.StoreName ? store.StoreName + ' ' : ''}${store.Address}`;
        
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
    }
  } catch (error) {
    console.error(`❌ Database check failed for store: ${store.StoreId}`, error);
  }
  return store;
}
