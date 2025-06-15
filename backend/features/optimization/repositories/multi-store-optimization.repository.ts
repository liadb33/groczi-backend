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

// --- Function to fetch data for Multi-Store DP Optimization (LIST-BASED) ---
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