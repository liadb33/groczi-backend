/**
 * Repository for stores data access.
 * In a real application, this would interact with a database through Prisma or other ORM.
 */

import { Store } from "../../shared/types/stores.type.js";
import prisma from "../../shared/prisma-client/prisma-client.js";

/**
 * Get all stores.
 * Returns all stores.
 */
export async function findAllStores(): Promise<Store[]> {

  try {
    const stores = await prisma.stores.findMany();
    console.log(stores);
    return stores;
  } catch (error) {
    console.error('Error fetching stores:', error);
    throw error;
  }
}

/**
 * Find a store by its ID.
//  */
// export async function findStoreById(storeId: number): Promise<Store | null> {
//   return prisma.stores.findUnique({
//     where: { StoreId: storeId },
//     select: {
//       ChainId: true,
//       SubChainId: true,
//       StoreId: true,
//       StoreName: true,
//       Address: true,
//       City: true,
//       ZipCode: true,
//       StoreType: true,
//     },
//   });
// }
