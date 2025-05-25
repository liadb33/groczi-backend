import prisma from "../../shared/prisma-client/prisma-client.js";
import { v4 as uuidv4 } from "uuid";
import {
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

// get cart items by device id
export const getCartItemsByDeviceId = async (deviceId: string) => {
  return await prisma.cart_item.findMany({
    where: { deviceId },
    orderBy: { createdAt: "asc" },
    include: {
      grocery: {
        include: {
          store_grocery: {
            select: {
              itemPrice: true,
            },
          },
        },
      },
    },
  });
};


// add cart item
export const upsertCartItem = async (
  deviceId: string,
  itemCode: string,
  quantity: number
) => {
  return await prisma.cart_item.upsert({
    where: {
      deviceId_itemCode: { deviceId, itemCode },
    },
    update: { quantity },
    create: {
      id: uuidv4(), // or uuidv4()
      deviceId,
      itemCode,
      quantity,
    },
  });
};


// update cart item quantity
export const updateCartItemQuantity = async (
  deviceId: string,
  cartItemId: string,
  quantityDelta: number
) => {
  const currentItem = await prisma.cart_item.findFirst({
    where: { id: cartItemId, deviceId },
  });

  if (!currentItem) {
    throw new Error(`Cart item not found: ${cartItemId}`);
  }

  const newQuantity = currentItem.quantity + quantityDelta;

  if (newQuantity <= 0) {
    await prisma.cart_item.delete({
      where: { id: cartItemId },
    });
    return null;
  }

  return await prisma.cart_item.update({
    where: { id: cartItemId },
    data: { quantity: newQuantity },
  });
};



// remove item from cart
export const removeCartItem = async (deviceId: string, cartItemId: string) => {
 
  const item = await prisma.cart_item.findFirst({
    where: { id: cartItemId, deviceId },
  });

  if (!item) {
    throw new Error(`Cart item not found or unauthorized`);
  }
  return await prisma.cart_item.delete({
    where: { id: cartItemId },
  });
};

// --- NEW: Types for Optimization Data Fetching ---
export interface CartItemDetailForOptimization {
  itemCode: string;
  quantity: number;
  itemName: string;
}

export interface EligibleStoreForOptimization {
  storeId: string;
  storeName: string;
  address: string;
  city: string;
  zipcode: string;
  location: [number, number];
  distanceKm: number;
  itemPrices: {
    [itemCode: string]: number;
  };
}

// --- NEW: Function to fetch data for Single-Store Optimization ---
export async function fetchDataForSingleStoreCartOptimization(
  deviceId: string,
  userLocation: [number, number],
  maxDistanceKm: number
): Promise<{ cartItems: CartItemDetailForOptimization[], eligibleStores: EligibleStoreForOptimization[] }> {
  const userCartDBItems = await prisma.cart_item.findMany({
    where: { deviceId: deviceId },
    select: { itemCode: true, quantity: true },
  });

  if (userCartDBItems.length === 0) {
    return { cartItems: [], eligibleStores: [] };
  }
  const itemCodesInCart = userCartDBItems.map(ci => ci.itemCode);

  const groceryDetails = await prisma.grocery.findMany({
    where: { itemCode: { in: itemCodesInCart } },
    select: { itemCode: true, itemName: true },
  });
  const itemCodeToNameMap = new Map<string, string>();
  groceryDetails.forEach(g => {
    if (g.itemName) {
      itemCodeToNameMap.set(g.itemCode, g.itemName);
    }
  });

  const cartItems: CartItemDetailForOptimization[] = userCartDBItems.map(ci => ({
    itemCode: ci.itemCode,
    quantity: ci.quantity,
    itemName: itemCodeToNameMap.get(ci.itemCode) || ci.itemCode,
  }));

  const allDbStoresWithLocation = await prisma.stores.findMany({
    where: { Latitude: { not: null }, Longitude: { not: null } },
    select: { 
      StoreId: true, 
      StoreName: true, 
      Latitude: true, 
      Longitude: true,
      Address: true,
      City: true,
      ZipCode: true
    },
  });

  const nearbyStoreCandidates: {
    storeId: string;
    storeName: string;
    address: string;
    city: string;
    zipcode: string;
    location: [number, number];
    distanceKm: number;
  }[] = [];

  for (const dbStore of allDbStoresWithLocation) {
    if (!dbStore.StoreId || !dbStore.Latitude || !dbStore.Longitude) {
      continue;
    }
    const distance = calculateHaversineDistance(
      userLocation[0], userLocation[1],
      dbStore.Latitude, dbStore.Longitude
    );
    if (distance <= maxDistanceKm) {
      nearbyStoreCandidates.push({
        storeId: dbStore.StoreId,
        storeName: dbStore.StoreName || 'Unknown Store',
        address: dbStore.Address || '',
        city: dbStore.City || '',
        zipcode: dbStore.ZipCode || '',
        location: [dbStore.Latitude, dbStore.Longitude],
        distanceKm: distance,
      });
    }
  }

  if (nearbyStoreCandidates.length === 0) {
    return { cartItems, eligibleStores: [] };
  }

  const nearbyStoreIds = nearbyStoreCandidates.map(s => s.storeId);

  const relevantStoreGroceries = await prisma.store_grocery.findMany({
    where: {
      StoreId: { in: nearbyStoreIds },
      itemCode: { in: itemCodesInCart },
    },
    select: { StoreId: true, itemCode: true, itemPrice: true },
  });

  const pricesByStoreId: { [storeId: string]: { [itemCode: string]: number } } = {};
  relevantStoreGroceries.forEach(sg => {
    if (!sg.StoreId) return;
    const storeId = sg.StoreId;
    if (!pricesByStoreId[storeId]) {
      pricesByStoreId[storeId] = {};
    }
    pricesByStoreId[storeId][sg.itemCode] = Number(sg.itemPrice);
  });

  const eligibleStores: EligibleStoreForOptimization[] = [];
  for (const candidate of nearbyStoreCandidates) {
    const storeItemPrices = pricesByStoreId[candidate.storeId];
    if (!storeItemPrices) {
      continue;
    }
    let allItemsAvailableAtThisStore = true;
    for (const itemCode of itemCodesInCart) {
      if (storeItemPrices[itemCode] === undefined) {
        allItemsAvailableAtThisStore = false;
        break;
      }
    }
    if (allItemsAvailableAtThisStore) {
      eligibleStores.push({
        storeId: candidate.storeId,
        storeName: candidate.storeName,
        address: candidate.address,
        city: candidate.city,
        zipcode: candidate.zipcode,
        location: candidate.location,
        distanceKm: candidate.distanceKm,
        itemPrices: storeItemPrices,
      });
    }
  }
  return { cartItems, eligibleStores };
}

// --- NEW: Function to fetch data for Multi-Store DP Optimization ---
export async function fetchDataForMultiStoreCartOptimization(
  deviceId: string,
  userLocation: [number, number], // [userLatitude, userLongitude]
  maxStoreDistanceKm: number     // Max distance for a store to be *initially considered*
): Promise<{
  dpGroceryList: DPGroceryList;
  dpStoresData: DPStoresData;    // Stores within maxStoreDistanceKm that are candidates
  dpPricesMatrix: DPPricesMatrix;// Prices only for items in cart and for stores in dpStoresData
  itemDetailsMap: Map<string, { itemName: string }>; // For enriching results with item names
}> {
  // 1. Get user's current cart items
  const userCartDBItems = await prisma.cart_item.findMany({
    where: { deviceId: deviceId },
    select: { itemCode: true, quantity: true },
  });

  if (userCartDBItems.length === 0) {
    // Return empty structures if cart is empty
    return { dpGroceryList: {}, dpStoresData: {}, dpPricesMatrix: {}, itemDetailsMap: new Map() };
  }

  const dpGroceryList: DPGroceryList = {};
  const itemCodesInCart: string[] = [];
  userCartDBItems.forEach(ci => {
    dpGroceryList[ci.itemCode] = ci.quantity;
    if (!itemCodesInCart.includes(ci.itemCode)) { // Build a unique list of item codes
      itemCodesInCart.push(ci.itemCode);
    }
  });

  // 2. Get item names for enrichment
  const groceryDetails = await prisma.grocery.findMany({
    where: { itemCode: { in: itemCodesInCart } },
    select: { itemCode: true, itemName: true },
  });
  const itemDetailsMap = new Map<string, { itemName: string }>();
  groceryDetails.forEach(g => {
    if (g.itemName) {
      itemDetailsMap.set(g.itemCode, { itemName: g.itemName });
    }
  });

  // 3. Fetch ALL stores that have a location
  const allDbStoresWithLocation = await prisma.stores.findMany({
    where: { Latitude: { not: null }, Longitude: { not: null } }, // Ensure stores have coordinates
    select: { StoreId: true, StoreName: true, Latitude: true, Longitude: true, Address: true, City: true, ZipCode: true },
  });

  // 4. Filter these stores by distance from the user to get "candidate stores" for DP
  const dpStoresData: DPStoresData = {};
  const candidateStoreIds: string[] = [];

  for (const dbStore of allDbStoresWithLocation) {
    if (!dbStore.StoreId || !dbStore.Latitude || !dbStore.Longitude) {
      continue;
    }
    // Prisma guarantees Latitude and Longitude are not null here due to the 'where' clause
    const distance = calculateHaversineDistance(
      userLocation[0], userLocation[1],
      dbStore.Latitude, dbStore.Longitude
    );

    if (distance <= maxStoreDistanceKm) {
      dpStoresData[dbStore.StoreId] = {
        location: [dbStore.Latitude, dbStore.Longitude],
        storeName: dbStore.StoreName || 'Unknown Store', // Fallback for name
        address: dbStore.Address || '',
        city: dbStore.City || '',
        zipcode: dbStore.ZipCode || '',
      };
      candidateStoreIds.push(dbStore.StoreId);
    }
  }

  if (candidateStoreIds.length === 0) {
    // No stores within the initial max distance, DP won't have candidates
    return { dpGroceryList, dpStoresData: {}, dpPricesMatrix: {}, itemDetailsMap };
  }

  // 5. Fetch all item prices from `store_grocery` for items in the cart AND for the candidate (nearby) stores
  const relevantStoreGroceries = await prisma.store_grocery.findMany({
    where: {
      StoreId: { in: candidateStoreIds },
      itemCode: { in: itemCodesInCart },
    },
    select: { StoreId: true, itemCode: true, itemPrice: true },
  });

  // 6. Construct the prices matrix for the DP algorithm
  // Initialize with candidate stores having empty price lists first
  const dpPricesMatrix: DPPricesMatrix = {};
  for (const storeId of candidateStoreIds) {
    dpPricesMatrix[storeId] = {}; // Initialize empty price object for each candidate store
  }

  relevantStoreGroceries.forEach(sg => {
    // Only process if StoreId is valid and it's one of our candidate stores
    if (sg.StoreId && dpPricesMatrix[sg.StoreId]) {
      dpPricesMatrix[sg.StoreId][sg.itemCode] = Number(sg.itemPrice); // Ensure price is a number
    }
  });

  // Ensure all items in cart have price entries (even if float('inf')) for all candidate stores
  // This is crucial for the DP logic to correctly identify unavailable items.
  for (const storeId of candidateStoreIds) {
    for (const itemCode of itemCodesInCart) {
      if (!(itemCode in dpPricesMatrix[storeId])) {
        dpPricesMatrix[storeId][itemCode] = Infinity; // Mark as unavailable
      }
    }
  }

  return { dpGroceryList, dpStoresData, dpPricesMatrix, itemDetailsMap };
}
