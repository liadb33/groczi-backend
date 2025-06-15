import { Request, Response, NextFunction } from "express";
import { 
  fetchDataForMultiStoreFromList,
} from "../repositories/multi-store-optimization.repository.js";
import { 
  runTopNMultiStoreDPForList,
} from "../services/multi-store-optimization.service.js";
import {
  OptimizeMultiStoreListRequestBody,
  TopMultiStoreSolutionsResult,
} from "../../shared/types/optimization.types.js";

// --- Controller for Multi-Store DP Optimization (List-Based, Top N) ---
export const optimizeMultiStoreForListController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // const deviceId = req.deviceId; // Available if ensureDeviceUser is used, for logging etc.

  const {
    userLatitude,
    userLongitude,
    items: customItemsInput, // Mandatory
    costPerDistanceUnit = 1.0,
    lambdaTravel = 1.0, // Added for multi-store scoring consistency
    maxStores,
    maxTravelDistance,
    maxStoreDistance = 150.0, // Default initial filter distance for candidates
  }: OptimizeMultiStoreListRequestBody = req.body;

  // Validate required inputs
  if (userLatitude === undefined || userLongitude === undefined) {
    return res.status(400).json({ message: "User latitude and longitude are required." });
  }
  if (!customItemsInput || !Array.isArray(customItemsInput) || customItemsInput.length === 0) {
    return res.status(400).json({ message: "A non-empty 'items' array is required." });
  }
  for (const item of customItemsInput) { // Validate individual items
      if (!item.itemCode || typeof item.quantity !== 'number' || item.quantity <= 0) {
          return res.status(400).json({ message: "Each item in the list must have an itemCode and a positive numeric quantity." });
      }
  }

  // Convert and validate numeric parameters
  const parsedUserLocation: [number, number] = [parseFloat(String(userLatitude)), parseFloat(String(userLongitude))];
  const numCostPerDistanceUnit = parseFloat(String(costPerDistanceUnit));
  const numLambdaTravel = parseFloat(String(lambdaTravel)); // For scoring in DP
  const numMaxInitialStoreDistance = parseFloat(String(maxStoreDistance));

  const numMaxStoresInSolution = maxStores !== undefined ? parseInt(String(maxStores), 10) : undefined;
  const numMaxTravelForSolution = maxTravelDistance !== undefined ? parseFloat(String(maxTravelDistance)) : undefined;

  if (isNaN(parsedUserLocation[0]) || isNaN(parsedUserLocation[1]) ||
      isNaN(numCostPerDistanceUnit) || numCostPerDistanceUnit < 0 ||
      isNaN(numLambdaTravel) || numLambdaTravel < 0 || // Added lambdaTravel validation
      isNaN(numMaxInitialStoreDistance) || numMaxInitialStoreDistance < 0 ||
      (numMaxStoresInSolution !== undefined && (isNaN(numMaxStoresInSolution) || numMaxStoresInSolution < 1)) ||
      (numMaxTravelForSolution !== undefined && (isNaN(numMaxTravelForSolution) || numMaxTravelForSolution < 0)) ) {
    return res.status(400).json({ message: "Invalid numeric input for location or optimization parameters." });
  }

  try {
    const { dpGroceryList, dpStoresData, dpPricesMatrix, itemDetailsMap } =
      await fetchDataForMultiStoreFromList(parsedUserLocation, numMaxInitialStoreDistance, customItemsInput);

    if (Object.keys(dpGroceryList).length === 0) {
      return res.status(400).json({ message: "The provided item list is effectively empty or items are invalid." });
    }
    if (Object.keys(dpStoresData).length === 0) {
      return res.status(404).json({
        message: "No stores found within the specified initial 'maxStoreDistance' to consider."
      });
    }

    const numCandidateStores = Object.keys(dpStoresData).length;
    const numUniqueCartItems = Object.keys(dpGroceryList).length;
    if (numCandidateStores > 10 || numUniqueCartItems > 12) {
        console.warn(`PERFORMANCE WARNING: Multi-Store DP called with ${numCandidateStores} candidate stores and ${numUniqueCartItems} unique items. This might be very slow.`);
    }

    const result: TopMultiStoreSolutionsResult = await runTopNMultiStoreDPForList(
      dpGroceryList,
      dpStoresData,
      dpPricesMatrix,
      parsedUserLocation,
      numCostPerDistanceUnit,
      numLambdaTravel, // Pass lambdaTravel to the service
      itemDetailsMap,
      numMaxStoresInSolution,
      numMaxTravelForSolution,
      3 // Hardcoding to return Top 3 solutions
    );

    if (result.solutions.length === 0) {
      return res.status(404).json({
        message: "Could not find any feasible multi-store solutions with the given constraints."
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in optimizeMultiStoreForListController:', error);
    if (error instanceof Error) {
        next(error);
    } else {
        next(new Error('An unknown error occurred during multi-store optimization.'));
    }
  }
}; 