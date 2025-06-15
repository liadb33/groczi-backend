import prisma from "../../shared/prisma-client/prisma-client.js";
import { CustomOptimizationItem } from "../../shared/types/optimization.types.js";

// --- Helper: Calculate Distance (Haversine) ---
function calculateHaversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const radLat1 = lat1 * Math.PI / 180;
  const radLon1 = lon1 * Math.PI / 180;
  const radLat2 = lat2 * Math.PI / 180;
  const radLon2 = lon2 * Math.PI / 180;
  const dLat = radLat2 - radLat1;
  const dLon = radLon2 - radLon1;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(radLat1) * Math.cos(radLat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Types for Single Store Optimization ---
export interface InputItemForOptimization {
  itemCode: string;
  quantity: number;
  itemName: string;
}

export interface StoreDataForOptimization {
  storeId: string;
  storeName: string;
  address: string;
  city: string;
  chainId: string;     // Chain ID for the store
  subChainId: string;  // Sub-chain ID for the store
  location: [number, number];
  distanceKm: number;
  itemPrices: { // Prices for items from the input list that THIS store stocks
    [itemCode: string]: number;
  };
}

// --- Function to fetch data for Single-Store Optimization ---
export async function fetchDataForSingleStoreFromList(
  userLocation: [number, number],
  maxDistanceKm: number,
  providedItems: CustomOptimizationItem[]
): Promise<{ itemsToOptimize: InputItemForOptimization[], candidateStores: StoreDataForOptimization[] }> {

  if (providedItems.length === 0) {
    return { itemsToOptimize: [], candidateStores: [] };
  }
  const itemCodesToFetch = providedItems.map(i => i.itemCode);

  // 1. Enrich item names
  const itemDetailsMap = new Map<string, string>();
  const itemCodesNeedingNames = providedItems.filter(i => !i.itemName).map(i => i.itemCode);
  if (itemCodesNeedingNames.length > 0) {
    const groceryDetails = await prisma.grocery.findMany({
      where: { itemCode: { in: itemCodesNeedingNames } },
      select: { itemCode: true, itemName: true },
    });
    groceryDetails.forEach(g => { if (g.itemName) itemDetailsMap.set(g.itemCode, g.itemName); });
  }
  const itemsToOptimize: InputItemForOptimization[] = providedItems.map(item => ({
    itemCode: item.itemCode,
    quantity: item.quantity,
    itemName: item.itemName || itemDetailsMap.get(item.itemCode) || item.itemCode,
  }));

  // 2. Fetch ALL stores that have a location
  const allDbStoresWithLocation = await prisma.stores.findMany({
    where: { Latitude: { not: null }, Longitude: { not: null } },
    select: { StoreId: true, StoreName: true, Latitude: true, Longitude: true, Address: true, City: true, ChainId: true, SubChainId: true },
  });

  // 3. Filter these stores by distance
  const nearbyStoreCandidatesInfo: {
    storeId: string; storeName: string; address: string; city: string;
    chainId: string; subChainId: string;
    location: [number, number]; distanceKm: number;
  }[] = [];
  for (const dbStore of allDbStoresWithLocation) {
    if (!dbStore.StoreId || !dbStore.Latitude || !dbStore.Longitude) continue;
    const distance = calculateHaversineDistance(userLocation[0], userLocation[1], dbStore.Latitude, dbStore.Longitude);
    if (distance <= maxDistanceKm) {
      nearbyStoreCandidatesInfo.push({
        storeId: dbStore.StoreId, storeName: dbStore.StoreName || 'Unknown Store',
        address: dbStore.Address || '', city: dbStore.City || '',
        chainId: dbStore.ChainId, subChainId: dbStore.SubChainId,
        location: [dbStore.Latitude, dbStore.Longitude], distanceKm: distance,
      });
    }
  }

  if (nearbyStoreCandidatesInfo.length === 0) {
    return { itemsToOptimize, candidateStores: [] };
  }
  const nearbyStoreIds = nearbyStoreCandidatesInfo.map(s => s.storeId);

  // 4. Fetch all item prices for itemsToFetch AND for the nearby stores
  const relevantStoreGroceries = await prisma.store_grocery.findMany({
    where: { StoreId: { in: nearbyStoreIds }, itemCode: { in: itemCodesToFetch } },
    select: { StoreId: true, itemCode: true, itemPrice: true },
  });

  const pricesByStoreId: { [storeId: string]: { [itemCode: string]: number } } = {};
  relevantStoreGroceries.forEach(sg => {
    if (!sg.StoreId) return;
    if (!pricesByStoreId[sg.StoreId]) pricesByStoreId[sg.StoreId] = {};
    pricesByStoreId[sg.StoreId][sg.itemCode] = Number(sg.itemPrice);
  });

  // 5. Construct candidateStores: include all nearby stores that have AT LEAST ONE item.
  //    The service layer will then determine full vs. partial match.
  const candidateStores: StoreDataForOptimization[] = [];
  for (const candidate of nearbyStoreCandidatesInfo) {
    const storeItemPrices = pricesByStoreId[candidate.storeId];
    if (storeItemPrices && Object.keys(storeItemPrices).length > 0) { // Store has at least one of the requested items
      candidateStores.push({
        storeId: candidate.storeId,
        storeName: candidate.storeName,
        address: candidate.address,
        city: candidate.city,
        chainId: candidate.chainId,
        subChainId: candidate.subChainId,
        location: candidate.location,
        distanceKm: candidate.distanceKm,
        itemPrices: storeItemPrices, // Only includes prices for items it stocks from the input list
      });
    }
  }
  return { itemsToOptimize, candidateStores };
} 