/**
 * Repository for groceries data access.
 * In a real application, this would interact with a database through Prisma or other ORM.
 */

// Type definition for grocery items
export interface GroceryItem {
  itemCode: string;
  name: string;
  category: string;
  weight?: string;
  basePrice: number;
  chain: string;
}

// Mock data (typically this would be in a database)
const MOCK_GROCERIES: GroceryItem[] = [
  {
    itemCode: 'GRC-001',
    name: 'Organic Milk',
    category: 'Dairy',
    weight: '1L',
    basePrice: 3.50,
    chain: 'Good Grocer',
  },
  {
    itemCode: 'GRC-002',
    name: 'Whole Wheat Bread',
    category: 'Bakery',
    weight: '500g',
    basePrice: 2.80,
    chain: 'MegaMart',
  },
  {
    itemCode: 'GRC-003',
    name: 'Apples (Gala)',
    category: 'Produce',
    weight: '1kg',
    basePrice: 4.20,
    chain: 'Farm Fresh Co.',
  },
  {
    itemCode: 'GRC-004',
    name: 'Chicken Breast',
    category: 'Meat',
    weight: '1kg',
    basePrice: 9.99,
    chain: 'MegaMart',
  },
  {
    itemCode: 'GRC-005',
    name: 'Cheddar Cheese',
    category: 'Dairy',
    weight: '250g',
    basePrice: 5.15,
    chain: 'Good Grocer',
  },
];

/**
 * Get all grocery items.
 * In a real application, this would query the database.
 */
export function findAllGroceries(): GroceryItem[] {
  return MOCK_GROCERIES;
}

/**
 * Find a grocery item by its code.
 * In a real application, this would query the database.
 */
export function findGroceryByCode(code: string): GroceryItem | undefined {
  return MOCK_GROCERIES.find(item => item.itemCode === code);
}

// Add more repository methods as needed:
// - createGrocery
// - updateGrocery
// - deleteGrocery
// - findGroceriesByCategory
// etc. 