/**
 * Repository for stores data access.
 * In a real application, this would interact with a database through Prisma or other ORM.
 */

import { Store } from "../../shared/types/stores.type.js";
import prisma from "../../shared/prisma-client/prisma-client.js";



//find all stores
export async function findAllStores(): Promise<Store[]> {

  try {
    const stores = await prisma.stores.findMany({
      include: {
        subchains: {
          select: {
            imageUrl: true,
            SubChainName: true
          }
        }
      }
    });
    return stores;
  } catch (error) {
    console.error('Error fetching stores:', error);
    throw error;
  }
}

//find store by id
export async function findStoreById(storeId: string): Promise<Store | null> {
  try {
    const store = await prisma.stores.findFirst({
      where: { StoreId: storeId },
      include: {
        subchains: {
          select: {
            imageUrl: true,
            SubChainName: true
          }
        }
      }
    });
    return store;
  } catch (error) {
    console.error("Error fetching store by ID:", error);
    throw error;
  }
}



// calculate haversine distance
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


// get nearby stores from location
export async function getNearbyStoresFromLocation(
  userLat: number,
  userLon: number,
  maxDistance: number,
  limit: number
): Promise<(Store & { distance: string })[]> {
  const allStores = await prisma.stores.findMany({
    where: {
      Latitude: { not: null },
      Longitude: { not: null },
    },
    include: {
      subchains: {
        select: {
          imageUrl: true,
          SubChainName: true
        }
      }
    }
  });

  const storesWithDistance = allStores
  .map((store) => {
    const rawDistance = haversineDistance(
      userLat,
      userLon,
      store.Latitude!,
      store.Longitude!
    );
    const formattedDistance = `${rawDistance.toFixed(2)}`;
    return { ...store, distance: formattedDistance };
  })
  .filter((store) => parseFloat(store.distance) <= maxDistance)
  .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
  .slice(0, limit);

  return storesWithDistance;
}