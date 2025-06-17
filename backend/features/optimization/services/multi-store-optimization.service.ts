import {
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

function multiStoreTravelCostTspNn(
  userLoc: [number, number],
  storesToVisit: { storeId: string; location: [number, number] }[],
  costPerDistanceUnit: number
): number {
  if (storesToVisit.length === 0) return 0;
  
  // Single store optimization
  if (storesToVisit.length === 1) {
    const storeLocation = storesToVisit[0].location;
    const distanceToStore = calculateDistanceForTSP(userLoc, storeLocation);
    return (distanceToStore * 2) * costPerDistanceUnit; // Round trip
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

// --- Multi-Store DP Algorithm for Top N Solutions (LIST-BASED) ---
export async function runTopNMultiStoreDPForList(
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
    // TEMPORARILY store the DP solution for later travel cost calculation
    allPotentialSolutions.push({
      finalStoreUsageMask: finalStoreMaskCandidate,
      itemCost: totalItemCostForCandidate,
      travelCostRaw: 0, // Will be calculated after backtracking
      totalCostWithLambda: 0, // Will be calculated after backtracking
    });
  }

  if (allPotentialSolutions.length === 0) return { solutions: [] };

  // Process each solution: do backtracking first, then calculate travel cost
  const processedSolutions: {
    assignments: MultiStoreSolution['assignments'];
    itemCost: number;
    travelCost: number;
    totalCost: number;
    scoringCost: number;
  }[] = [];

  for (const solCandidate of allPotentialSolutions) {
    const assignments: MultiStoreSolution['assignments'] = {};
    
    let tempItemMask = finalItemMask;
    let tempStoreMask = solCandidate.finalStoreUsageMask;
    let backtrackingSuccessful = true;
    
    const storesActuallyUsed = new Set<string>();
    
    while (tempItemMask > 0) {
      if (!parent.has(tempItemMask) || !parent.get(tempItemMask)!.has(tempStoreMask)) {
        backtrackingSuccessful = false; break;
      }
      const pData = parent.get(tempItemMask)!.get(tempStoreMask)!;
      const itemIdx = pData.itemIdx; const storeIdx = pData.storeIdx;
      const itemCode = itemCodes[itemIdx]; const storeId = storeIds[storeIdx];
      
      storesActuallyUsed.add(storeId);
      
      const storeInfo = dpStoresData[storeId];
      const storeKey = storeInfo.storeName || storeId;
      if (!assignments![storeKey]) {
        // Calculate distance from user to this store
        const distanceToStore = calculateDistanceForTSP(userLocation, storeInfo.location);
        
        assignments![storeKey] = { 
          store_id: storeId, 
          address: storeInfo.address, 
          city: storeInfo.city, 
          latitude: storeInfo.location[0], 
          longitude: storeInfo.location[1], 
          chainId: storeInfo.chainId,
          subChainId: storeInfo.subChainId,
          distance_km: parseFloat(distanceToStore.toFixed(2)),
          items: [] 
        };
      }
      const quantity = dpGroceryList[itemCode]; const price = dpPricesMatrix[storeId]?.[itemCode] ?? Infinity;
      assignments![storeKey].items.push({ itemCode, itemName: itemDetailsMap.get(itemCode)?.itemName || itemCode, quantity, price: parseFloat(price.toFixed(2)) });
      tempItemMask = pData.prevItemMask; tempStoreMask = pData.prevStoreMask;
    }
    
    if (!backtrackingSuccessful) continue;
    
    // NOW calculate travel cost based on ONLY the stores actually used
    const actualStoresToVisit: { storeId: string; location: [number, number] }[] = [];
    for (const storeId of storesActuallyUsed) {
      actualStoresToVisit.push({ 
        storeId: storeId, 
        location: dpStoresData[storeId].location 
      });
    }
    
    const actualTravelDistanceKm = multiStoreTravelCostTspNn(userLocation, actualStoresToVisit, 1);
    const actualTravelCost = actualTravelDistanceKm * costPerDistanceUnit;
    
    // Apply travel distance constraint
    if (actualTravelDistanceKm > maxTravelForSolution) {
      continue;
    }
    
    const totalCost = solCandidate.itemCost + actualTravelCost;
    const scoringCost = solCandidate.itemCost + lambdaTravel * actualTravelCost;
    
    processedSolutions.push({
      assignments,
      itemCost: solCandidate.itemCost,
      travelCost: actualTravelCost,
      totalCost,
      scoringCost
    });
  }

  if (processedSolutions.length === 0) return { solutions: [] };

  // Sort by scoring cost (items + lambda * travel)
  processedSolutions.sort((a, b) => a.scoringCost - b.scoringCost);

  const topSolutions: MultiStoreSolution[] = [];
  for (let i = 0; i < Math.min(topNSolutionsToReturn, processedSolutions.length); i++) {
    const sol = processedSolutions[i];
    topSolutions.push({
      assignments: sol.assignments,
      total_cost: parseFloat(sol.totalCost.toFixed(2)),
      item_cost: parseFloat(sol.itemCost.toFixed(2)),
      travel_cost: parseFloat(sol.travelCost.toFixed(2)),
    });
  }
  return { solutions: topSolutions };
} 