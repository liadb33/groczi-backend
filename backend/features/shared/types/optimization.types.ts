// backend/shared/types/optimization.types.ts

// --- Input for Custom Item List (used by request body) ---
export interface CustomOptimizationItem {
  itemCode: string;
  quantity: number;
  itemName?: string; // Optional: client can provide, or backend can enrich
}

// --- Input Body for Single-Store Optimization (NOW ALWAYS LIST-BASED) ---
export interface OptimizeSingleStoreListRequestBody { // Renamed for clarity
  userLatitude: number;
  userLongitude: number;
  items: CustomOptimizationItem[]; // List of items to optimize is now mandatory
  costPerDistanceUnit?: number;
  lambdaTravel?: number;
  maxStoreDistance?: number;
}

// --- Item detail within a store's evaluation (remains the same) ---
interface ItemInListEvaluation { // Changed name slightly for clarity within SingleStoreEvaluation
    itemCode: string;
    itemName: string;
    quantity: number; // This is the requested quantity
    priceAtThisStore: number;
}

// --- UPDATED: Structure for a single store's evaluation ---
export interface SingleStoreEvaluation {
  store_id: string;
  store_name: string;
  address: string;
  city: string;
  zipcode: string;
  combined_score: number;       // Score based on items it *does* have
  item_cost_at_store: number;   // Cost of items it *does* have
  travel_cost_to_store: number;
  distance_to_store_km: number;
  items_in_list: ItemInListEvaluation[]; // Items from the original list that this store *has*
  missing_items: string[];           // itemCodes from the original list that this store *does not have*
}

// --- UPDATED: Result for Ranked Single-Store Optimization ---
export interface RankedStoresOptimizationResult {
  is_partial_match: boolean; // True if fallback to partial matches was used
  ranked_stores: SingleStoreEvaluation[];
}

// --- Multi-Store DP Optimization Types (updated for list-based) ---
export interface OptimizeMultiStoreListRequestBody { // Will also be list-based
  userLatitude: number;
  userLongitude: number;
  items: CustomOptimizationItem[];
  costPerDistanceUnit?: number;
  lambdaTravel?: number;
  maxStores?: number;
  maxTravelDistance?: number;
  maxStoreDistance?: number;
}

// --- Keep existing DP types for multi-store ---
export interface DPGroceryList { 
  [itemCode: string]: number; 
}

export interface DPStoreInfo { 
  location: [number, number]; 
  storeName: string; 
  address: string; 
  city: string; 
  zipcode: string; 
}

export interface DPStoresData { 
  [storeId: string]: DPStoreInfo; 
}

export interface DPPricesMatrix { 
  [storeId: string]: { 
    [itemCode: string]: number; 
  }; 
}

export interface MultiStoreSolution {
  assignments: { 
    [storeNameOrId: string]: { 
      store_id: string; 
      address: string; 
      city: string; 
      zipcode: string; 
      items: { 
        itemCode: string; 
        itemName: string; 
        quantity: number; 
        price: number; 
      }[]; 
    }; 
  } | null;
  total_cost: number; 
  item_cost: number; 
  travel_cost: number;
}

export interface TopMultiStoreSolutionsResult { 
  solutions: MultiStoreSolution[]; 
}

// --- Legacy types (keep for backward compatibility with cart routes) ---
export interface OptimizeSingleStoreRequestBody {
  userLatitude: number;
  userLongitude: number;
  costPerDistanceUnit?: number;
  lambdaTravel?: number;
  maxStoreDistance?: number;
}

export interface OptimizeMultiStoreRequestBody {
  userLatitude: number;
  userLongitude: number;
  costPerDistanceUnit?: number;
  lambdaTravel?: number;
  maxStores?: number;
  maxTravelDistance?: number;
  maxStoreDistance?: number;
}
