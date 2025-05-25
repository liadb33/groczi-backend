import { Request, Response, NextFunction } from "express";
import {
  getCartItemsByDeviceId,
  upsertCartItem,
  removeCartItem,
  updateCartItemQuantity,
  fetchDataForSingleStoreCartOptimization,
  fetchDataForMultiStoreCartOptimization,
} from "../repositories/cart.repository.js";
import { 
  rankEligibleStoresForCart,
  runTopNMultiStoreDPCartOptimization,
} from "../services/optimization.service.js";
import {
  OptimizeSingleStoreRequestBody,
  RankedStoresOptimizationResult,
  OptimizeMultiStoreRequestBody,
  TopMultiStoreSolutionsResult
} from "../../shared/types/optimization.types.js";


// format cart response
const formatCartResponse = (cartItems: any[]) => {
  const items = cartItems.map((item) => {
    const prices =
      item.grocery?.store_grocery
        ?.map((p : any) => Number(p.itemPrice))
        .filter(Boolean) ?? [];
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const name =
      item.grocery?.itemName ||
      "Unknown";
    const subtotal = minPrice * item.quantity;

    return {
      cartItemId: item.id,
      itemCode: item.itemCode,
      name,
      quantity: item.quantity,
      subtotal: subtotal.toFixed(2),
    };
  });

  return { items };
};


// get cart items by device id
export const getCartController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  try {
    const cartItems = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(cartItems));
  } catch (error) {
    console.error("Failed to fetch cart:", error);
    next(error);
  }
};

// add cart item
export const addCartItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { itemCode, quantity } = req.body;

  if (!itemCode || !quantity || typeof quantity !== "number") {
    return res
      .status(400)
      .json({ message: "itemCode and numeric quantity are required" });
  }

  try {
    // Make sure quantity is a positive integer
    const parsedQuantity = Math.max(1, Math.round(quantity));
    
    await upsertCartItem(deviceId, itemCode, parsedQuantity);
    
    const updatedCart = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error("Failed to upsert cart item:", error);
    next(error);
  }
};

// update cart item quantity -  increments the quantity 
export const updateCartItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { cartItemId } = req.params;
  const { quantity } = req.body;

  if (!cartItemId || quantity === undefined || typeof quantity !== "number") {
    return res
      .status(400)
      .json({ message: "cartItemId and numeric quantity are required" });
  }

  try {
    const parsedQuantityDelta = Math.round(quantity);

    await updateCartItemQuantity(deviceId, cartItemId, parsedQuantityDelta);

    const updatedCart = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error("Failed to update cart item:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    next(error);
  }
};


// remove item from cart
export const removeCartItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { cartItemId } = req.params;

  if (!cartItemId) {
    return res.status(400).json({ message: "cartItemId is required" });
  }

  try {
    await removeCartItem(deviceId, cartItemId);

    const updatedCart = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error("Failed to remove cart item:", error);
    next(error);
  }
};

// --- Controller for Single-Store Cart Optimization (to rank stores) ---
export const optimizeAndRankStoresForCartController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const {
    userLatitude,
    userLongitude,
    costPerDistanceUnit = 1.0,
    lambdaTravel = 1.0,
    maxStoreDistance = 150.0,
  }: OptimizeSingleStoreRequestBody = req.body;

  if (userLatitude === undefined || userLongitude === undefined) {
    return res.status(400).json({ message: "User latitude and longitude are required in the request body." });
  }

  const parsedUserLocation: [number, number] = [parseFloat(String(userLatitude)), parseFloat(String(userLongitude))];
  const numCostPerDistanceUnit = parseFloat(String(costPerDistanceUnit));
  const numLambdaTravel = parseFloat(String(lambdaTravel));
  const numMaxStoreDistance = parseFloat(String(maxStoreDistance));

  if (isNaN(parsedUserLocation[0]) || isNaN(parsedUserLocation[1]) ||
      isNaN(numCostPerDistanceUnit) || numCostPerDistanceUnit < 0 ||
      isNaN(numLambdaTravel) || numLambdaTravel < 0 ||
      isNaN(numMaxStoreDistance) || numMaxStoreDistance < 0) {
    return res.status(400).json({ message: "Invalid or missing numeric input for location or optimization parameters. Parameters must be non-negative." });
  }

  try {
    const { cartItems, eligibleStores } =
      await fetchDataForSingleStoreCartOptimization(deviceId, parsedUserLocation, numMaxStoreDistance);

    if (cartItems.length === 0) {
      return res.status(404).json({ message: `Cart for device ${deviceId} is empty.` });
    }
    if (eligibleStores.length === 0) {
      return res.status(404).json({
        message: "No stores found within the specified distance that stock all items in the cart."
      });
    }

    const result: RankedStoresOptimizationResult = await rankEligibleStoresForCart(
      cartItems,
      eligibleStores,
      numCostPerDistanceUnit,
      numLambdaTravel
    );
    res.json(result);
  } catch (error) {
    console.error('Error in optimizeAndRankStoresForCartController:', error);
    if (error instanceof Error) {
        next(error);
    } else {
        next(new Error('An unknown error occurred during cart optimization.'));
    }
  }
};

// --- NEW: Controller for Multi-Store DP Cart Optimization (Top N Solutions) ---
export const optimizeMultiStoreCartController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;

  const {
    userLatitude,
    userLongitude,
    costPerDistanceUnit = 1.0,    // Default cost per km for round trip calculation
    lambdaTravel = 1.0,           // Default weighting factor for travel cost
    maxStores,                    // Optional: Max number of unique stores in a solution
    maxTravelDistance,            // Optional: Max total travel distance (km) for a solution's TSP route
    maxStoreDistance = 150.0,     // Optional: Max distance (km) for a store to be initially considered
  }: OptimizeMultiStoreRequestBody = req.body;

  // Validate required inputs
  if (userLatitude === undefined || userLongitude === undefined) {
    return res.status(400).json({ message: "User latitude and longitude are required in the request body." });
  }

  // Convert and validate numeric inputs
  const parsedUserLocation: [number, number] = [parseFloat(String(userLatitude)), parseFloat(String(userLongitude))];
  const numCostPerDistanceUnit = parseFloat(String(costPerDistanceUnit));
  const numLambdaTravel = parseFloat(String(lambdaTravel));
  const numMaxInitialStoreDistance = parseFloat(String(maxStoreDistance)); // For initial store filtering

  // Optional constraints for the DP solution itself
  const numMaxStoresInSolution = maxStores !== undefined ? parseInt(String(maxStores), 10) : undefined;
  const numMaxTravelForSolution = maxTravelDistance !== undefined ? parseFloat(String(maxTravelDistance)) : undefined;

  // Basic validation for numbers
  if (isNaN(parsedUserLocation[0]) || isNaN(parsedUserLocation[1]) ||
      isNaN(numCostPerDistanceUnit) || numCostPerDistanceUnit < 0 ||
      isNaN(numLambdaTravel) || numLambdaTravel < 0 ||
      isNaN(numMaxInitialStoreDistance) || numMaxInitialStoreDistance < 0 ||
      (numMaxStoresInSolution !== undefined && (isNaN(numMaxStoresInSolution) || numMaxStoresInSolution < 1)) ||
      (numMaxTravelForSolution !== undefined && (isNaN(numMaxTravelForSolution) || numMaxTravelForSolution < 0)) ) {
    return res.status(400).json({ message: "Invalid or missing numeric input for location or optimization parameters. Parameters must be non-negative, and maxStores > 0 if provided." });
  }

  try {
    const { dpGroceryList, dpStoresData, dpPricesMatrix, itemDetailsMap } =
      await fetchDataForMultiStoreCartOptimization(deviceId, parsedUserLocation, numMaxInitialStoreDistance);

    if (Object.keys(dpGroceryList).length === 0) {
      return res.status(404).json({ message: `Cart for device ${deviceId} is empty.` });
    }
    if (Object.keys(dpStoresData).length === 0) {
      return res.status(404).json({
        message: "No stores found within the specified initial 'maxStoreDistance' to consider for multi-store optimization."
      });
    }

    // Warning for potentially slow DP execution (important for user experience or debugging)
    const numCandidateStores = Object.keys(dpStoresData).length;
    const numUniqueCartItems = Object.keys(dpGroceryList).length;
    if (numCandidateStores > 10 || numUniqueCartItems > 12) { // Adjust these thresholds based on typical performance
        console.warn(`PERFORMANCE WARNING: Multi-Store DP called with ${numCandidateStores} candidate stores and ${numUniqueCartItems} unique items. This might be very slow or consume significant memory.`);
        // For a production app, you might return an error here or switch to a heuristic.
        // For this project, allowing it to run (with a warning) is fine for demonstration.
    }

    const result: TopMultiStoreSolutionsResult = await runTopNMultiStoreDPCartOptimization(
      dpGroceryList,
      dpStoresData,
      dpPricesMatrix,
      parsedUserLocation,
      numCostPerDistanceUnit,
      numLambdaTravel,
      itemDetailsMap,
      numMaxStoresInSolution,
      numMaxTravelForSolution,
      3 // Hardcoding to return Top 3 solutions as per the requirement
    );

    if (result.solutions.length === 0) {
      return res.status(404).json({
        message: "Could not find any feasible multi-store solutions with the given constraints."
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in optimizeMultiStoreCartController:', error);
    if (error instanceof Error) {
        next(error);
    } else {
        next(new Error('An unknown error occurred during multi-store cart optimization.'));
    }
  }
};

