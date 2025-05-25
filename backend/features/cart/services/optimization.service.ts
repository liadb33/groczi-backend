import {
  CartItemDetailForOptimization,
  EligibleStoreForOptimization,
} from "../repositories/cart.repository.js";
import { 
  RankedStoresOptimizationResult, 
  SingleStoreEvaluation,
  DPGroceryList,
  DPStoresData,
  DPPricesMatrix,
  MultiStoreSolution,
  TopMultiStoreSolutionsResult,
} from "../../shared/types/optimization.types.js";

// --- Helper: Calculate Distance (Haversine, for TSP) ---
function calculateDistanceForTSP(loc1: [number, number], loc2: [number, number]): number {
  const R = 6371; // km
  const radLat1 = loc1[0] * Math.PI / 180;
  const radLon1 = loc1[1] * Math.PI / 180;
  const radLat2 = loc2[0] * Math.PI / 180;
  const radLon2 = loc2[1] * Math.PI / 180;
  const dLat = radLat2 - radLat1;
  const dLon = radLon2 - radLon1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Helper: Multi-Store Travel Cost (TSP Nearest Neighbor Heuristic) ---
function multiStoreTravelCostTspNn(
  userLoc: [number, number],
  storesToVisit: { storeId: string; location: [number, number] }[],
  costPerDistanceUnit: number
): number {
  if (storesToVisit.length === 0) {
    return 0;
  }

  const locationsToVisit: { id: string; loc: [number, number] }[] = [
    { id: "_user_start", loc: userLoc },
    ...storesToVisit.map(s => ({ id: s.storeId, loc: s.location })),
  ];

  let currentLocationNode = locationsToVisit.find(l => l.id === "_user_start")!;
  const unvisitedStoreIds = new Set(storesToVisit.map(s => s.storeId));
  let totalDistance = 0;

  while (unvisitedStoreIds.size > 0) {
    let nearestDist = Infinity;
    let nearestStoreIdCandidate: string | null = null;

    for (const storeIdToConsider of unvisitedStoreIds) {
      const storeNodeToConsider = locationsToVisit.find(l=> l.id === storeIdToConsider)!;
      const dist = calculateDistanceForTSP(currentLocationNode.loc, storeNodeToConsider.loc);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStoreIdCandidate = storeIdToConsider;
      }
    }

    if (nearestStoreIdCandidate) {
      totalDistance += nearestDist;
      currentLocationNode = locationsToVisit.find(l=> l.id === nearestStoreIdCandidate)!;
      unvisitedStoreIds.delete(nearestStoreIdCandidate);
    } else {
      break;
    }
  }

  // Return to user's location from the last visited store
  totalDistance += calculateDistanceForTSP(currentLocationNode.loc, userLoc);
  return totalDistance * costPerDistanceUnit;
}

// --- Helper: Count Set Bits (for maxStores constraint) ---
function countSetBits(n: number): number {
  let count = 0;
  while (n > 0) {
    n &= (n - 1);
    count++;
  }
  return count;
}

// --- Helper: Calculate Single Store Travel Cost (using pre-calculated distance) ---
function calculateSingleStoreTravelCost(
  distanceKm: number,
  costPerDistanceUnit: number
): number {
  return 2 * distanceKm * costPerDistanceUnit;
}

// --- Updated Algorithm Logic to Rank All Eligible Stores ---
export async function rankEligibleStoresForCart(
  cartItems: CartItemDetailForOptimization[],
  eligibleStores: EligibleStoreForOptimization[],
  costPerDistanceUnit: number,
  lambdaTravel: number
): Promise<RankedStoresOptimizationResult> {
  const evaluatedStores: SingleStoreEvaluation[] = [];

  if (cartItems.length === 0 || eligibleStores.length === 0) {
    return { ranked_stores: [] };
  }

  for (const storeInfo of eligibleStores) {
    let currentTotalItemCostForThisStore = 0;
    const itemsWithPricesForThisStore: SingleStoreEvaluation['items_in_cart'] = [];

    for (const cartItem of cartItems) {
      const price = storeInfo.itemPrices[cartItem.itemCode];
      const itemSubtotal = price * cartItem.quantity;
      currentTotalItemCostForThisStore += itemSubtotal;
      itemsWithPricesForThisStore.push({
        itemCode: cartItem.itemCode,
        itemName: cartItem.itemName,
        quantity: cartItem.quantity,
        priceAtThisStore: parseFloat(price.toFixed(2)),
      });
    }

    const currentTravelCostForThisStore = calculateSingleStoreTravelCost(
      storeInfo.distanceKm,
      costPerDistanceUnit
    );

    const combinedScore = currentTotalItemCostForThisStore + lambdaTravel * currentTravelCostForThisStore;

    evaluatedStores.push({
      store_id: storeInfo.storeId,
      store_name: storeInfo.storeName,
      address: storeInfo.address,
      city: storeInfo.city,
      zipcode: storeInfo.zipcode,
      combined_score: parseFloat(combinedScore.toFixed(2)),
      item_cost_at_store: parseFloat(currentTotalItemCostForThisStore.toFixed(2)),
      travel_cost_to_store: parseFloat(currentTravelCostForThisStore.toFixed(2)),
      distance_to_store_km: parseFloat(storeInfo.distanceKm.toFixed(2)),
      items_in_cart: itemsWithPricesForThisStore,
    });
  }

  evaluatedStores.sort((a, b) => a.combined_score - b.combined_score);

  return {
    ranked_stores: evaluatedStores,
  };
}

// --- NEW: The Multi-Store DP Algorithm for Top N Solutions ---
export async function runTopNMultiStoreDPCartOptimization(
  dpGroceryList: DPGroceryList,
  dpStoresData: DPStoresData,      // Candidate stores (already filtered by initial maxStoreDistance)
  dpPricesMatrix: DPPricesMatrix,
  userLocation: [number, number],
  costPerDistanceUnit: number,
  lambdaTravel: number,            // Weighting factor for travel cost vs item cost trade-off
  itemDetailsMap: Map<string, { itemName: string }>, // For enriching output
  maxStoresConstraint?: number,    // Max # of unique stores in a *final solution*
  maxTravelDistanceConstraint?: number, // Max total travel distance for a *final solution*
  topNSolutionsToReturn: number = 3 // How many top solutions to backtrack and return
): Promise<TopMultiStoreSolutionsResult> {
  const itemCodes = Object.keys(dpGroceryList);
  // storeIds are derived from dpStoresData, which are already pre-filtered by maxStoreDistance
  const storeIds = Object.keys(dpStoresData);

  const n_items = itemCodes.length;
  const m_stores = storeIds.length;

  // Effective constraints for the DP and final filtering
  const maxStoresInSolution = maxStoresConstraint === undefined || maxStoresConstraint <= 0 ? Infinity : maxStoresConstraint;
  const maxTravelForSolution = maxTravelDistanceConstraint === undefined || maxTravelDistanceConstraint <=0 ? Infinity : maxTravelDistanceConstraint;

  if (n_items === 0) {
    return { solutions: [] }; // No items in cart, no solutions
  }
  if (m_stores === 0) {
    console.warn("Multi-Store DP (TopN): No candidate stores after initial distance filter.");
    return { solutions: [] }; // No stores to consider
  }

  const finalItemMask = (1 << n_items) - 1;

  // DP table: dp[item_mask] maps to a Map<store_mask, min_item_cost>
  const dp = new Map<number, Map<number, number>>();
  // Parent table for backtracking: parent[item_mask] maps to a Map<store_mask, parent_info>
  const parent = new Map<number, Map<number, { prevItemMask: number; prevStoreMask: number; itemIdx: number; storeIdx: number }>>();

  // Base case: 0 items, 0 stores used, 0 item cost
  const initialStoreMaskMap = new Map<number, number>();
  initialStoreMaskMap.set(0, 0); // store_mask 0, cost 0
  dp.set(0, initialStoreMaskMap);  // item_mask 0

  // DP Calculation (Iterate through all possible subsets of items)
  for (let currentItemMask = 0; currentItemMask < (1 << n_items); currentItemMask++) {
    if (!dp.has(currentItemMask)) continue; // Skip unreachable item subsets

    const storeMasksMapForCurrentItems = dp.get(currentItemMask)!;

    for (const [currentStoreUsageMask, currentAccumulatedItemCost] of storeMasksMapForCurrentItems) {
      if (currentAccumulatedItemCost === Infinity) continue; // Skip if this path is already infinitely costly

      // Find the next item to try adding (e.g., the one with the smallest index not yet in currentItemMask)
      let itemToAddIndex = -1;
      for (let j = 0; j < n_items; j++) {
        if (!((currentItemMask >> j) & 1)) { // If j-th bit (item) is not set in currentItemMask
          itemToAddIndex = j;
          break;
        }
      }
      if (itemToAddIndex === -1) continue; // All items in this currentItemMask subset are already "assigned" for this path

      const nextItemMaskState = currentItemMask | (1 << itemToAddIndex);
      const itemCodeToAssign = itemCodes[itemToAddIndex];
      const quantity = dpGroceryList[itemCodeToAssign];

      // Try assigning this new item to each of the m_stores (candidate stores)
      for (let storeIndexToTry = 0; storeIndexToTry < m_stores; storeIndexToTry++) {
        const storeIdToTry = storeIds[storeIndexToTry];
        const pricePerUnit = dpPricesMatrix[storeIdToTry]?.[itemCodeToAssign] ?? Infinity;

        if (pricePerUnit === Infinity) continue; // Item not available at this store

        const costIncreaseForThisItem = pricePerUnit * quantity;
        const potentialNewTotalItemCost = currentAccumulatedItemCost + costIncreaseForThisItem;
        const nextStoreUsageMask = currentStoreUsageMask | (1 << storeIndexToTry);

        // Apply maxStoresConstraint *during* DP build-up
        if (countSetBits(nextStoreUsageMask) > maxStoresInSolution) {
          continue;
        }

        // Initialize maps if they don't exist for the next state
        if (!dp.has(nextItemMaskState)) dp.set(nextItemMaskState, new Map<number, number>());
        if (!parent.has(nextItemMaskState)) parent.set(nextItemMaskState, new Map<number, any>());

        const currentBestCostForNextDPState = dp.get(nextItemMaskState)!.get(nextStoreUsageMask) ?? Infinity;

        if (potentialNewTotalItemCost < currentBestCostForNextDPState) {
          dp.get(nextItemMaskState)!.set(nextStoreUsageMask, potentialNewTotalItemCost);
          parent.get(nextItemMaskState)!.set(nextStoreUsageMask, {
            prevItemMask: currentItemMask,
            prevStoreMask: currentStoreUsageMask,
            itemIdx: itemToAddIndex,       // Index in itemCodes array
            storeIdx: storeIndexToTry,     // Index in storeIds array
          });
        }
      }
    }
  }

  // --- Find ALL valid final solutions and rank them ---
  const allPotentialSolutions: {
    finalStoreUsageMask: number;
    itemCost: number;
    travelCost: number;
    totalCost: number;
  }[] = [];

  if (!dp.has(finalItemMask) || dp.get(finalItemMask)!.size === 0) {
    console.warn("Multi-Store DP (TopN): No DP state found for acquiring all items.");
    return { solutions: [] };
  }

  const finalDPCostStates = dp.get(finalItemMask)!;
  for (const [finalStoreMaskCandidate, totalItemCostForCandidate] of finalDPCostStates) {
    const storesToVisitInThisOption: { storeId: string; location: [number, number] }[] = [];
    for (let k = 0; k < m_stores; k++) {
      if ((finalStoreMaskCandidate >> k) & 1) { // If k-th store is in this store_mask
        const sId = storeIds[k];
        storesToVisitInThisOption.push({ storeId: sId, location: dpStoresData[sId].location });
      }
    }

    const currentTravelCost = multiStoreTravelCostTspNn(
      userLocation,
      storesToVisitInThisOption,
      costPerDistanceUnit
    );

    // Apply maxTravelForSolution constraint
    if (currentTravelCost > maxTravelForSolution) {
      continue;
    }

    const currentTotalOverallCost = totalItemCostForCandidate + lambdaTravel * currentTravelCost;
    allPotentialSolutions.push({
      finalStoreUsageMask: finalStoreMaskCandidate,
      itemCost: totalItemCostForCandidate,
      travelCost: currentTravelCost,
      totalCost: currentTotalOverallCost,
    });
  }

  if (allPotentialSolutions.length === 0) {
    console.warn("Multi-Store DP (TopN): No feasible solutions found after applying travel constraints.");
    return { solutions: [] };
  }

  // Sort all potential solutions by their totalCost (ascending)
  allPotentialSolutions.sort((a, b) => a.totalCost - b.totalCost);

  // --- Backtrack for the Top N solutions ---
  const topSolutions: MultiStoreSolution[] = [];

  for (let i = 0; i < Math.min(topNSolutionsToReturn, allPotentialSolutions.length); i++) {
    const solutionCandidate = allPotentialSolutions[i];
    const assignments: MultiStoreSolution['assignments'] = {}; // Initialize for this solution

    let tempItemMask = finalItemMask;
    let tempStoreMask = solutionCandidate.finalStoreUsageMask;
    let backtrackingSuccessful = true;

    while (tempItemMask > 0) {
      if (!parent.has(tempItemMask) || !parent.get(tempItemMask)!.has(tempStoreMask)) {
        console.error(`Multi-Store DP (TopN): Parent tracking error during backtracking for solution rank ${i+1}. ItemMask: ${tempItemMask}, StoreMask: ${tempStoreMask}`);
        backtrackingSuccessful = false; // Mark this solution's backtracking as failed
        break;
      }
      const parentData = parent.get(tempItemMask)!.get(tempStoreMask)!;
      const itemIdxAssigned = parentData.itemIdx;
      const storeIdxAssignedTo = parentData.storeIdx;

      const itemCode = itemCodes[itemIdxAssigned];
      const storeId = storeIds[storeIdxAssignedTo];
      const storeInfo = dpStoresData[storeId]; // Get full store info

      const storeKeyForOutput = storeInfo.storeName || storeId; // Use name, fallback to ID
      if (!assignments![storeKeyForOutput]) {
        assignments![storeKeyForOutput] = {
          store_id: storeId,
          address: storeInfo.address,
          city: storeInfo.city,
          zipcode: storeInfo.zipcode,
          items: []
        };
      }

      const quantity = dpGroceryList[itemCode];
      const price = dpPricesMatrix[storeId]?.[itemCode] ?? Infinity; // Should be a valid price here

      assignments![storeKeyForOutput].items.push({
        itemCode: itemCode,
        itemName: itemDetailsMap.get(itemCode)?.itemName || itemCode,
        quantity: quantity,
        price: parseFloat(price.toFixed(2)),
      });

      tempItemMask = parentData.prevItemMask;
      tempStoreMask = parentData.prevStoreMask;
    }

    if (backtrackingSuccessful) {
        topSolutions.push({
            assignments: assignments,
            total_cost: parseFloat(solutionCandidate.totalCost.toFixed(2)),
            item_cost: parseFloat(solutionCandidate.itemCost.toFixed(2)),
            travel_cost: parseFloat((lambdaTravel * solutionCandidate.travelCost).toFixed(2)),
        });
    } else {
        console.warn(`Multi-Store DP (TopN): Failed to fully backtrack solution candidate with total_cost ${solutionCandidate.totalCost}. It will be skipped.`);
    }
  }

  return {
    solutions: topSolutions,
  };
}
