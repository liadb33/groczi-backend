import { Request, Response, NextFunction } from "express";
import { 
  fetchDataForSingleStoreFromList,
} from "../repositories/single-store-optimization.repository.js";
import { 
  rankEligibleStoresForItemList,
} from "../services/single-store-optimization.service.js";
import {
  OptimizeSingleStoreListRequestBody,
  RankedStoresOptimizationResult,
} from "../../shared/types/optimization.types.js";

// --- Controller for Single-Store Optimization (List-Based) ---
export const optimizeSingleStoreForListController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const {
    userLatitude,
    userLongitude,
    items: customItemsInput,
    costPerDistanceUnit = 1.0,
    lambdaTravel = 1.0,
    maxStoreDistance = 150.0,
  }: OptimizeSingleStoreListRequestBody = req.body;

  // Validations
  if (userLatitude === undefined || userLongitude === undefined) { 
    return res.status(400).json({ message: "קו רוחב וקו אורך של המשתמש נדרשים." }); 
  }
  if (!customItemsInput || !Array.isArray(customItemsInput) || customItemsInput.length === 0) { 
    return res.status(400).json({ message: "נדרש מערך 'items' שאינו ריק."}); 
  }
  for (const item of customItemsInput) { 
    if (!item.itemCode || typeof item.quantity !== 'number' || item.quantity <= 0) { 
      return res.status(400).json({ message: "מבנה פריט לא תקין."}); 
    }
  }
  const parsedUserLocation: [number, number] = [parseFloat(String(userLatitude)), parseFloat(String(userLongitude))];
  const numCostPerDistanceUnit = parseFloat(String(costPerDistanceUnit));
  const numLambdaTravel = parseFloat(String(lambdaTravel));
  const numMaxStoreDistance = parseFloat(String(maxStoreDistance));
  if (isNaN(parsedUserLocation[0])||isNaN(parsedUserLocation[1])||isNaN(numCostPerDistanceUnit)||numCostPerDistanceUnit<0||isNaN(numLambdaTravel)||numLambdaTravel<0||isNaN(numMaxStoreDistance)||numMaxStoreDistance<0) { 
    return res.status(400).json({ message: "פרמטרים מספריים לא תקינים."});
  }

  try {
    // fetchDataForSingleStoreFromList now returns 'candidateStores'
    const { itemsToOptimize, candidateStores } =
      await fetchDataForSingleStoreFromList(parsedUserLocation, numMaxStoreDistance, customItemsInput);

    if (itemsToOptimize.length === 0) {
        return res.status(400).json({ message: "רשימת הפריטים הנתונה ריקה בפועל או שהפריטים לא תקינים." });
    }

    // The service will handle the case of no candidate stores.
    // If candidateStores is empty here, rankEligibleStoresForItemList will return an empty ranked_stores list.

    const result: RankedStoresOptimizationResult = await rankEligibleStoresForItemList(
      itemsToOptimize,
      candidateStores, // Pass candidate stores to the service
      numCostPerDistanceUnit,
      numLambdaTravel
    );

    // Check if any stores were found, even if partial
    if (result.ranked_stores.length === 0) {
      // This message implies no stores (even partial) met criteria or were found.
      // The is_partial_match flag in the result helps differentiate.
      return res.status(404).json({
        message: "לא נמצאו חנויות (אפילו עם התאמות חלקיות) במרחק שנקבע או שמחזיקות פריטים מהרשימה."
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in optimizeSingleStoreForListController:', error);
    if (error instanceof Error) {
        next(error);
    } else {
        next(new Error('An unknown error occurred during single-store optimization.'));
    }
  }
}; 