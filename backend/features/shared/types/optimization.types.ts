// backend/shared/types/optimization.types.ts

// Input expected in the request body for the optimization
export interface OptimizeSingleStoreRequestBody {
  userLatitude: number;
  userLongitude: number;
  costPerDistanceUnit?: number;
  lambdaTravel?: number;
  maxStoreDistance?: number;
}

// Structure for a single store's evaluation
export interface SingleStoreEvaluation {
  store_id: string;
  store_name: string;
  address: string;
  city: string;
  zipcode: string;
  combined_score: number;
  item_cost_at_store: number;
  travel_cost_to_store: number;
  distance_to_store_km: number;
  items_in_cart: {
    itemCode: string;
    itemName: string;
    quantity: number;
    priceAtThisStore: number;
  }[];
}

// The structure of the result returned by the optimization API
export interface RankedStoresOptimizationResult {
  ranked_stores: SingleStoreEvaluation[];
}

// --- Multi-Store DP Optimization Types ---

// Input expected in the request body for multi-store optimization
export interface OptimizeMultiStoreRequestBody {
  userLatitude: number;
  userLongitude: number;
  costPerDistanceUnit?: number;
  lambdaTravel?: number;           // Weighting factor for travel cost vs item cost trade-off
  maxStores?: number;              // Max number of unique stores in a solution
  maxTravelDistance?: number;      // Max total travel distance (for the TSP part of a solution)
  maxStoreDistance?: number;       // Max distance for a store to be *initially considered* by the repo
}

// Internal structures for the DP algorithm
export interface DPGroceryList {
  [itemCode: string]: number; // quantity
}

export interface DPStoreInfo { // Information about stores passed to DP
  location: [number, number]; // [latitude, longitude]
  storeName: string;
  address: string;
  city: string;
  zipcode: string;
}

export interface DPStoresData { // StoreId -> DPStoreInfo
  [storeId: string]: DPStoreInfo;
}

export interface DPPricesMatrix { // storeId -> itemCode -> price
  [storeId: string]: {
    [itemCode: string]: number; // price, or Infinity if not available
  };
}

// Structure for a single multi-store solution (part of the Top N result)
export interface MultiStoreSolution {
  assignments: {
    // Key is Store Name, fallback to Store ID if name is missing
    [storeNameOrId: string]: {
      store_id: string; // Original Store ID
      address: string;
      city: string;
      zipcode: string;
      items: {
        itemCode: string;
        itemName: string;
        quantity: number;
        price: number; // Price of this item at this store
      }[];
    };
  } | null; // Assignments can be null if backtracking fails for this specific solution path
  total_cost: number;
  item_cost: number;
  travel_cost: number;
  // `stores_visited_details` is removed from individual solutions as per requirement
}

// Final output structure for the Top N Multi-Store API
export interface TopMultiStoreSolutionsResult {
  solutions: MultiStoreSolution[];
}
