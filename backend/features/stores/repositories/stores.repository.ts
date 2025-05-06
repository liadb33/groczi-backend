/**
 * Repository for stores data access.
 * In a real application, this would interact with a database through Prisma or other ORM.
 */

// Type definition for store items
export interface StoreItem {
  storeId: string;
  name: string;
  address: string;
  city: string;
  chain: string;
  distance?: number;
}

// Mock data (typically this would be in a database)
const MOCK_STORES: StoreItem[] = [
  {
    storeId: 'STR-001',
    name: 'Downtown Market',
    address: '123 Main St',
    city: 'Metropolis',
    chain: 'Good Grocer'
  },
  {
    storeId: 'STR-002',
    name: 'Westside Supermarket',
    address: '456 Oak Ave',
    city: 'Metropolis',
    chain: 'MegaMart'
  },
  {
    storeId: 'STR-003',
    name: 'North End Foods',
    address: '789 Pine Rd',
    city: 'Smallville',
    chain: 'Farm Fresh Co.'
  }
];

/**
 * Get all stores.
 * In a real application, this would query the database.
 */
export function findAllStores(): StoreItem[] {
  return MOCK_STORES;
}

/**
 * Find a store by its ID.
 * In a real application, this would query the database.
 */
export function findStoreById(storeId: string): StoreItem | undefined {
  return MOCK_STORES.find(store => store.storeId === storeId);
}

/**
 * Find stores by chain name.
 * In a real application, this would query the database.
 */
export function findStoresByChain(chain: string): StoreItem[] {
  return MOCK_STORES.filter(store => store.chain === chain);
}

// Add more repository methods as needed:
// - createStore
// - updateStore
// - deleteStore
// - findStoresByCity
// etc. 