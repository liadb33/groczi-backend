import {
  InputItemForOptimization,
  StoreDataForOptimization,
} from "../repositories/single-store-optimization.repository.js";
import {
  RankedStoresOptimizationResult,
  SingleStoreEvaluation,
} from "../../shared/types/optimization.types.js";

// --- Helper: Calculate Single Store Travel Cost ---
function calculateSingleStoreTravelCost(
  distanceKm: number,
  costPerDistanceUnit: number
): number {
  return 2 * distanceKm * costPerDistanceUnit;
}

// --- Single Store Algorithm Logic to Rank Stores with Partial Match Fallback ---
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
        address: storeInfo.address, city: storeInfo.city,
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
        address: storeInfo.address, city: storeInfo.city, 
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