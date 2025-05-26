import prisma from "../../shared/prisma-client/prisma-client.js";
import { 
  CustomOptimizationItem,
  DPGroceryList,
  DPStoresData,
  DPPricesMatrix,
} from "../../shared/types/optimization.types.js";

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

// --- Types for this repository's functions ---
export interface InputItemForOptimization {
  itemCode: string;
  quantity: number;
  itemName: string;
}

// MODIFIED: StoreDataForOptimization no longer implies all items are present at this stage
export interface StoreDataForOptimization {
  storeId: string;
  storeName: string;
  address: string;
  city: string;
  zipcode: string;
  chainId: string;     // Chain ID for the store
  subChainId: string;  // Sub-chain ID for the store
  location: [number, number];
  distanceKm: number;
  itemPrices: { // Prices for items from the input list that THIS store stocks
    [itemCode: string]: number;
  };
}

// --- MODIFIED: Function to fetch data for Single-Store Optimization ---
export async function fetchDataForSingleStoreFromList(
  userLocation: [number, number],
  maxDistanceKm: number,
  providedItems: CustomOptimizationItem[]
): Promise<{ itemsToOptimize: InputItemForOptimization[], candidateStores: StoreDataForOptimization[] }> { // Renamed eligibleStores to candidateStores

  if (providedItems.length === 0) {
    return { itemsToOptimize: [], candidateStores: [] };
  }
  const itemCodesToFetch = providedItems.map(i => i.itemCode);

  // 1. Enrich item names (same as before)
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

  // 2. Fetch ALL stores that have a location (same as before)
  const allDbStoresWithLocation = await prisma.stores.findMany({
    where: { Latitude: { not: null }, Longitude: { not: null } },
    select: { StoreId: true, StoreName: true, Latitude: true, Longitude: true, Address: true, City: true, ZipCode: true, ChainId: true, SubChainId: true },
  });

  // 3. Filter these stores by distance (same as before)
  const nearbyStoreCandidatesInfo: {
    storeId: string; storeName: string; address: string; city: string; zipcode: string;
    chainId: string; subChainId: string;
    location: [number, number]; distanceKm: number;
  }[] = [];
  for (const dbStore of allDbStoresWithLocation) {
    if (!dbStore.StoreId || !dbStore.Latitude || !dbStore.Longitude) continue;
    const distance = calculateHaversineDistance(userLocation[0], userLocation[1], dbStore.Latitude, dbStore.Longitude);
    if (distance <= maxDistanceKm) {
      nearbyStoreCandidatesInfo.push({
        storeId: dbStore.StoreId, storeName: dbStore.StoreName || 'Unknown Store',
        address: dbStore.Address || '', city: dbStore.City || '', zipcode: dbStore.ZipCode || '',
        chainId: dbStore.ChainId, subChainId: dbStore.SubChainId,
        location: [dbStore.Latitude, dbStore.Longitude], distanceKm: distance,
      });
    }
  }

  if (nearbyStoreCandidatesInfo.length === 0) {
    return { itemsToOptimize, candidateStores: [] };
  }
  const nearbyStoreIds = nearbyStoreCandidatesInfo.map(s => s.storeId);

  // 4. Fetch all item prices for itemsToFetch AND for the nearby stores (same as before)
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
        zipcode: candidate.zipcode,
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

// --- NEW: Function to fetch data for Multi-Store DP Optimization (LIST-BASED) ---
export async function fetchDataForMultiStoreFromList(
  userLocation: [number, number],
  maxStoreDistanceKm: number,     // Max distance for a store to be *initially considered*
  providedItems: CustomOptimizationItem[] // Explicit list of items
): Promise<{
  dpGroceryList: DPGroceryList;
  dpStoresData: DPStoresData;    // Stores within maxStoreDistanceKm that are candidates
  dpPricesMatrix: DPPricesMatrix;// Prices only for items in list and for stores in dpStoresData
  itemDetailsMap: Map<string, { itemName: string }>; // For enriching results
}> {
  if (providedItems.length === 0) {
    return { dpGroceryList: {}, dpStoresData: {}, dpPricesMatrix: {}, itemDetailsMap: new Map() };
  }

  const dpGroceryList: DPGroceryList = {};
  const itemCodesInList: string[] = [];
  providedItems.forEach(item => {
    dpGroceryList[item.itemCode] = item.quantity;
    if (!itemCodesInList.includes(item.itemCode)) {
      itemCodesInList.push(item.itemCode);
    }
  });

  // Enrich item names if not fully provided, or use provided ones
  const itemDetailsMap = new Map<string, { itemName: string }>();
  const itemCodesNeedingNameFetch = providedItems
    .filter(i => !i.itemName)
    .map(i => i.itemCode);

  if (itemCodesNeedingNameFetch.length > 0) {
    const groceryDetails = await prisma.grocery.findMany({
      where: { itemCode: { in: itemCodesNeedingNameFetch } },
      select: { itemCode: true, itemName: true },
    });
    groceryDetails.forEach(g => {
      if (g.itemName) itemDetailsMap.set(g.itemCode, { itemName: g.itemName });
    });
  }
  // Populate map with names provided in the input list as well, prioritizing them
  providedItems.forEach(item => {
    if (item.itemName) {
        itemDetailsMap.set(item.itemCode, { itemName: item.itemName });
    } else if (!itemDetailsMap.has(item.itemCode)) {
        // Fallback if not provided and not fetched (e.g., item not in grocery table)
        itemDetailsMap.set(item.itemCode, { itemName: item.itemCode });
    }
  });

  // Fetch ALL stores with location
  const allDbStoresWithLocation = await prisma.stores.findMany({
    where: { Latitude: { not: null }, Longitude: { not: null } },
    select: { StoreId: true, StoreName: true, Latitude: true, Longitude: true, Address: true, City: true, ZipCode: true, ChainId: true, SubChainId: true },
  });

  // Filter stores by distance to get candidate stores for DP
  const dpStoresData: DPStoresData = {};
  const candidateStoreIds: string[] = [];
  for (const dbStore of allDbStoresWithLocation) {
    if (!dbStore.StoreId || !dbStore.Latitude || !dbStore.Longitude) continue;
    const distance = calculateHaversineDistance(
      userLocation[0], userLocation[1],
      dbStore.Latitude, dbStore.Longitude
    );
    if (distance <= maxStoreDistanceKm) {
      dpStoresData[dbStore.StoreId] = {
        location: [dbStore.Latitude, dbStore.Longitude],
        storeName: dbStore.StoreName || 'Unknown Store',
        address: dbStore.Address || '',
        city: dbStore.City || '',
        zipcode: dbStore.ZipCode || '',
        chainId: dbStore.ChainId,
        subChainId: dbStore.SubChainId,
      };
      candidateStoreIds.push(dbStore.StoreId);
    }
  }

  if (candidateStoreIds.length === 0) {
    return { dpGroceryList, dpStoresData: {}, dpPricesMatrix: {}, itemDetailsMap };
  }

  // Fetch prices for items in the list from candidate stores
  const relevantStoreGroceries = await prisma.store_grocery.findMany({
    where: {
      StoreId: { in: candidateStoreIds },
      itemCode: { in: itemCodesInList },
    },
    select: { StoreId: true, itemCode: true, itemPrice: true },
  });

  // Construct prices matrix
  const dpPricesMatrix: DPPricesMatrix = {};
  for (const storeId of candidateStoreIds) {
    dpPricesMatrix[storeId] = {};
  }
  relevantStoreGroceries.forEach(sg => {
    if (sg.StoreId && dpPricesMatrix[sg.StoreId]) {
      dpPricesMatrix[sg.StoreId][sg.itemCode] = Number(sg.itemPrice);
    }
  });
  for (const storeId of candidateStoreIds) {
    for (const itemCode of itemCodesInList) {
      if (!(itemCode in dpPricesMatrix[storeId])) {
        dpPricesMatrix[storeId][itemCode] = Infinity;
      }
    }
  }

  return { dpGroceryList, dpStoresData, dpPricesMatrix, itemDetailsMap };
}

// You will add fetchDataForMultiStoreOptimizationFromList here later 