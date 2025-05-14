/**
 * Repository for stores data access.
 * In a real application, this would interact with a database through Prisma or other ORM.
 */

import { Store } from "../../shared/types/stores.type.js";
import prisma from "../../shared/prisma-client/prisma-client.js";



//find all stores
export async function findAllStores(): Promise<Store[]> {

  try {
    const stores = await prisma.stores.findMany();
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
    });
    return store;
  } catch (error) {
    console.error("Error fetching store by ID:", error);
    throw error;
  }
}
