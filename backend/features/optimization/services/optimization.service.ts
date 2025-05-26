import {
  InputItemForOptimization,
  StoreDataForOptimization,
} from "../repositories/optimization.repository.js";
import {
  RankedStoresOptimizationResult,
  SingleStoreEvaluation,
  // Multi-Store types will be used here later for the second algorithm
  DPGroceryList,
  DPStoresData,
  DPPricesMatrix,
  MultiStoreSolution,
  TopMultiStoreSolutionsResult,
} from "../../shared/types/optimization.types.js";

// --- Helper: Calculate Single Store Travel Cost ---
function calculateSingleStoreTravelCost(
  distanceKm: number,
  costPerDistanceUnit: number
): number {
  return 2 * distanceKm * costPerDistanceUnit;
}

// --- MODIFIED: Algorithm Logic to Rank Stores with Partial Match Fallback ---
export async function rankEligibleStoresForItemList(
  itemsToOptimize: InputItemForOptimization[],
  candidateStores: StoreDataForOptimization[], // Stores that are nearby and have at least one item
  costPerDistanceUnit: number,
  lambdaTravel: number
): Promise<RankedStoresOptimizationResult> {
  if (itemsToOptimize.length === 0) {
    return { is_partial_match: false, ranked_stores: [] };
  }
  if (candidateStores.length === 0) {
    return { is_partial_match: false, ranked_stores: [] }; // Or true, if cart wasn't empty
  }

  const allRequestedItemCodes = new Set(itemsToOptimize.map(item => item.itemCode));
  let foundFullMatchStore = false;
  const evaluatedStores: SingleStoreEvaluation[] = [];

  // First pass: Check for stores with ALL items
  const fullMatchEvaluations: SingleStoreEvaluation[] = [];
  for (const storeInfo of candidateStores) {
    const availableItemCodesAtStore = new Set(Object.keys(storeInfo.itemPrices));
    let hasAllItems = true;
    for (const requestedCode of allRequestedItemCodes) {
      if (!availableItemCodesAtStore.has(requestedCode)) {
        hasAllItems = false;
        break;
      }
    }

    if (hasAllItems) {
      foundFullMatchStore = true;
      let currentTotalItemCost = 0;
      const itemsInListForThisStore: SingleStoreEvaluation['items_in_list'] = [];
      for (const item of itemsToOptimize) {
        const price = storeInfo.itemPrices[item.itemCode]; // Guaranteed to exist
        currentTotalItemCost += price * item.quantity;
        itemsInListForThisStore.push({
          itemCode: item.itemCode, itemName: item.itemName,
          quantity: item.quantity, priceAtThisStore: parseFloat(price.toFixed(2)),
        });
      }
      const travelCost = calculateSingleStoreTravelCost(storeInfo.distanceKm, costPerDistanceUnit);
      const combinedScore = currentTotalItemCost + lambdaTravel * travelCost;
      fullMatchEvaluations.push({
        store_id: storeInfo.storeId, store_name: storeInfo.storeName,
        address: storeInfo.address, city: storeInfo.city, zipcode: storeInfo.zipcode,
        latitude: storeInfo.location[0], longitude: storeInfo.location[1],
        chainId: storeInfo.chainId, subChainId: storeInfo.subChainId,
        combined_score: parseFloat(combinedScore.toFixed(2)),
        item_cost_at_store: parseFloat(currentTotalItemCost.toFixed(2)),
        travel_cost_to_store: parseFloat(travelCost.toFixed(2)),
        distance_to_store_km: parseFloat(storeInfo.distanceKm.toFixed(2)),
        items_in_list: itemsInListForThisStore,
        missing_items: [], // No missing items for a full match
      });
    }
  }

  if (foundFullMatchStore) {
    fullMatchEvaluations.sort((a, b) => a.combined_score - b.combined_score);
    return { is_partial_match: false, ranked_stores: fullMatchEvaluations };
  }

  // Fallback: No store has all items, so consider partial matches
  // (all candidateStores already have at least one item from the list)
  for (const storeInfo of candidateStores) {
    let currentTotalItemCostPartial = 0;
    const matchedItemsInList: SingleStoreEvaluation['items_in_list'] = [];
    const missingItemsForThisStore: string[] = [];

    for (const item of itemsToOptimize) {
      if (storeInfo.itemPrices[item.itemCode] !== undefined) {
        const price = storeInfo.itemPrices[item.itemCode];
        currentTotalItemCostPartial += price * item.quantity;
        matchedItemsInList.push({
          itemCode: item.itemCode, itemName: item.itemName,
          quantity: item.quantity, // Still show requested quantity
          priceAtThisStore: parseFloat(price.toFixed(2)),
        });
      } else {
        missingItemsForThisStore.push(item.itemCode);
      }
    }

    // Only proceed if at least one item was matched (repo already ensures this, but good check)
    if (matchedItemsInList.length > 0) {
      const travelCost = calculateSingleStoreTravelCost(storeInfo.distanceKm, costPerDistanceUnit);
      // Score is based only on items the store *has*
      const combinedScorePartial = currentTotalItemCostPartial + lambdaTravel * travelCost;

      evaluatedStores.push({
        store_id: storeInfo.storeId, store_name: storeInfo.storeName,
        address: storeInfo.address, city: storeInfo.city, zipcode: storeInfo.zipcode,
        latitude: storeInfo.location[0], longitude: storeInfo.location[1],
        chainId: storeInfo.chainId, subChainId: storeInfo.subChainId,
        combined_score: parseFloat(combinedScorePartial.toFixed(2)),
        item_cost_at_store: parseFloat(currentTotalItemCostPartial.toFixed(2)),
        travel_cost_to_store: parseFloat(travelCost.toFixed(2)),
        distance_to_store_km: parseFloat(storeInfo.distanceKm.toFixed(2)),
        items_in_list: matchedItemsInList,
        missing_items: missingItemsForThisStore,
      });
    }
  }

  evaluatedStores.sort((a, b) => a.combined_score - b.combined_score);
  return { is_partial_match: true, ranked_stores: evaluatedStores };
}

// --- Multi-Store DP Service function (runTopNMultiStoreDPOptimization) ---
// This will also need to be refactored later to accept a list of items (DPGroceryList)
// and an itemDetailsMap, rather than fetching from a deviceId.
// For now, keeping the signature you provided previously, but it will need adjustment.

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

function multiStoreTravelCostTspNn(
  userLoc: [number, number],
  storesToVisit: { storeId: string; location: [number, number] }[],
  costPerDistanceUnit: number
): number {
  if (storesToVisit.length === 0) return 0;
  
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

  totalDistance += calculateDistanceForTSP(currentLocationNode.loc, userLoc);
  return totalDistance * costPerDistanceUnit;
}

function countSetBits(n: number): number {
  let count = 0;
  while (n > 0) {
    n &= (n - 1);
    count++;
  }
  return count;
}

// --- REFACTORED: Multi-Store DP Algorithm for Top N Solutions (LIST-BASED) ---
export async function runTopNMultiStoreDPForList( // Renamed for clarity
  dpGroceryList: DPGroceryList, // Derived from the input CustomOptimizationItem[]
  dpStoresData: DPStoresData,
  dpPricesMatrix: DPPricesMatrix,
  userLocation: [number, number],
  costPerDistanceUnit: number,
  lambdaTravel: number, // Weighting factor for travel cost in final score
  itemDetailsMap: Map<string, { itemName: string }>,
  maxStoresConstraint?: number,
  maxTravelDistanceConstraint?: number,
  topNSolutionsToReturn: number = 3
): Promise<TopMultiStoreSolutionsResult> {
  const itemCodes = Object.keys(dpGroceryList);
  const storeIds = Object.keys(dpStoresData);
  const n_items = itemCodes.length;
  const m_stores = storeIds.length;

  const maxStoresInSolution = maxStoresConstraint === undefined || maxStoresConstraint <= 0 ? Infinity : maxStoresConstraint;
  const maxTravelForSolution = maxTravelDistanceConstraint === undefined || maxTravelDistanceConstraint <= 0 ? Infinity : maxTravelDistanceConstraint;

  if (n_items === 0 || m_stores === 0) {
    return { solutions: [] };
  }

  const finalItemMask = (1 << n_items) - 1;
  const dp = new Map<number, Map<number, number>>();
  const parent = new Map<number, Map<number, { prevItemMask: number; prevStoreMask: number; itemIdx: number; storeIdx: number }>>();

  const initialStoreMaskMap = new Map<number, number>();
  initialStoreMaskMap.set(0, 0);
  dp.set(0, initialStoreMaskMap);

  // DP Calculation (same core logic)
  for (let currentItemMask = 0; currentItemMask < (1 << n_items); currentItemMask++) {
    if (!dp.has(currentItemMask)) continue;
    const storeMasksMapForCurrentItems = dp.get(currentItemMask)!;
    for (const [currentStoreUsageMask, currentAccumulatedItemCost] of storeMasksMapForCurrentItems) {
      if (currentAccumulatedItemCost === Infinity) continue;
      let itemToAddIndex = -1;
      for (let j = 0; j < n_items; j++) {
        if (!((currentItemMask >> j) & 1)) { itemToAddIndex = j; break; }
      }
      if (itemToAddIndex === -1) continue;
      const nextItemMaskState = currentItemMask | (1 << itemToAddIndex);
      const itemCodeToAssign = itemCodes[itemToAddIndex];
      const quantity = dpGroceryList[itemCodeToAssign];
      for (let storeIndexToTry = 0; storeIndexToTry < m_stores; storeIndexToTry++) {
        const storeIdToTry = storeIds[storeIndexToTry];
        const pricePerUnit = dpPricesMatrix[storeIdToTry]?.[itemCodeToAssign] ?? Infinity;
        if (pricePerUnit === Infinity) continue;
        const costIncreaseForThisItem = pricePerUnit * quantity;
        const potentialNewTotalItemCost = currentAccumulatedItemCost + costIncreaseForThisItem;
        const nextStoreUsageMask = currentStoreUsageMask | (1 << storeIndexToTry);
        if (countSetBits(nextStoreUsageMask) > maxStoresInSolution) continue;
        if (!dp.has(nextItemMaskState)) dp.set(nextItemMaskState, new Map<number, number>());
        if (!parent.has(nextItemMaskState)) parent.set(nextItemMaskState, new Map<number, any>());
        const currentBestCostForNextDPState = dp.get(nextItemMaskState)!.get(nextStoreUsageMask) ?? Infinity;
        if (potentialNewTotalItemCost < currentBestCostForNextDPState) {
          dp.get(nextItemMaskState)!.set(nextStoreUsageMask, potentialNewTotalItemCost);
          parent.get(nextItemMaskState)!.set(nextStoreUsageMask, {
            prevItemMask: currentItemMask, prevStoreMask: currentStoreUsageMask,
            itemIdx: itemToAddIndex, storeIdx: storeIndexToTry,
          });
        }
      }
    }
  }

  const allPotentialSolutions: {
    finalStoreUsageMask: number; itemCost: number; travelCostRaw: number; totalCostWithLambda: number;
  }[] = [];

  if (!dp.has(finalItemMask) || dp.get(finalItemMask)!.size === 0) {
    return { solutions: [] };
  }

  const finalDPCostStates = dp.get(finalItemMask)!;
  for (const [finalStoreMaskCandidate, totalItemCostForCandidate] of finalDPCostStates) {
    const storesToVisitInThisOption: { storeId: string; location: [number, number] }[] = [];
    for (let k = 0; k < m_stores; k++) {
      if ((finalStoreMaskCandidate >> k) & 1) {
        const sId = storeIds[k];
        storesToVisitInThisOption.push({ storeId: sId, location: dpStoresData[sId].location });
      }
    }
    const currentTravelCostRaw = multiStoreTravelCostTspNn(userLocation, storesToVisitInThisOption, 1); // Raw distance units
    const currentTravelCostWithFactor = currentTravelCostRaw * costPerDistanceUnit;

    if (currentTravelCostRaw > maxTravelForSolution) { // Compare raw distance if maxTravelDistance is in km
        continue;
    }

    // The 'lambdaTravel' for multi-store usually applies to the actual travel cost for scoring
    // If lambdaTravel = 1, totalCost = itemCost + travelCostWithFactor
    // If lambdaTravel > 1, travel is penalized more.
    // Let's assume the "total_cost" field in MultiStoreSolution should be the actual spendable amount.
    // The ranking might use a different score (e.g. items + lambda * travel) if needed,
    // but the problem statement implies total_cost includes product prices + travel cost.
    // The previous example used lambdaTravel directly in the total cost for the DP.
    // For clarity, let's assume the `total_cost` in the solution is the actual spend.
    // The sorting should be based on `itemCost + lambdaTravel * travelCostRaw * costPerDistanceUnit`
    // or simply `itemCost + lambdaTravel * travelCostWithFactor`.
    // Let's adjust to use lambdaTravel for sorting, but store actual travel cost.

    const scoringCost = totalItemCostForCandidate + lambdaTravel * currentTravelCostWithFactor;

    allPotentialSolutions.push({
      finalStoreUsageMask: finalStoreMaskCandidate,
      itemCost: totalItemCostForCandidate,
      travelCostRaw: currentTravelCostWithFactor, // Actual travel cost
      totalCostWithLambda: scoringCost,           // Score used for ranking
    });
  }

  if (allPotentialSolutions.length === 0) return { solutions: [] };

  allPotentialSolutions.sort((a, b) => a.totalCostWithLambda - b.totalCostWithLambda);

  const topSolutions: MultiStoreSolution[] = [];
  for (let i = 0; i < Math.min(topNSolutionsToReturn, allPotentialSolutions.length); i++) {
    const solCandidate = allPotentialSolutions[i];
    const assignments: MultiStoreSolution['assignments'] = {};
    let tempItemMask = finalItemMask;
    let tempStoreMask = solCandidate.finalStoreUsageMask;
    let backtrackingSuccessful = true;
    while (tempItemMask > 0) {
      if (!parent.has(tempItemMask) || !parent.get(tempItemMask)!.has(tempStoreMask)) {
        backtrackingSuccessful = false; break;
      }
      const pData = parent.get(tempItemMask)!.get(tempStoreMask)!;
      const itemIdx = pData.itemIdx; const storeIdx = pData.storeIdx;
      const itemCode = itemCodes[itemIdx]; const storeId = storeIds[storeIdx];
      const storeInfo = dpStoresData[storeId];
      const storeKey = storeInfo.storeName || storeId;
      if (!assignments![storeKey]) {
        assignments![storeKey] = { 
          store_id: storeId, 
          address: storeInfo.address, 
          city: storeInfo.city, 
          zipcode: storeInfo.zipcode, 
          latitude: storeInfo.location[0], 
          longitude: storeInfo.location[1], 
          chainId: storeInfo.chainId,
          subChainId: storeInfo.subChainId,
          items: [] 
        };
      }
      const quantity = dpGroceryList[itemCode]; const price = dpPricesMatrix[storeId]?.[itemCode] ?? Infinity;
      assignments![storeKey].items.push({ itemCode, itemName: itemDetailsMap.get(itemCode)?.itemName || itemCode, quantity, price: parseFloat(price.toFixed(2)) });
      tempItemMask = pData.prevItemMask; tempStoreMask = pData.prevStoreMask;
    }
    if (backtrackingSuccessful) {
      topSolutions.push({
        assignments: assignments,
        total_cost: parseFloat((solCandidate.itemCost + solCandidate.travelCostRaw).toFixed(2)), // Actual total cost
        item_cost: parseFloat(solCandidate.itemCost.toFixed(2)),
        travel_cost: parseFloat(solCandidate.travelCostRaw.toFixed(2)),
      });
    }
  }
  return { solutions: topSolutions };
} 