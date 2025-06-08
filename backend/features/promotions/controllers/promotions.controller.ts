import { NextFunction, Request, Response } from "express";
import { getAllPromotions, getDiscountedGroceriesByPromotionId, getPromotionsByGroceryItemCode, getPromotionsByStore, getPromotionsGroupedByStore } from "../repositories/promotions.repository.js";

 // get all promotions
export const getAllPromotionsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const promotions = await getAllPromotions();
    res.json(promotions);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    next(error);
  }
};

// get discounted groceries by promotion id
export const getDiscountedGroceriesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { promotionId } = req.params;
  const { chainId, subChainId, storeId } = req.query;

  if (!chainId || !subChainId || !storeId) {
    return res.status(400).json({
      message: "Missing chainId, subChainId, or storeId",
    });
  }

  try {
    const promo = await getDiscountedGroceriesByPromotionId(
      promotionId,
      String(chainId),
      String(subChainId),
      String(storeId)
    );

    if (!promo) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    const groceries = promo.promotion_grocery.map((pg) => ({
      itemCode: pg.itemCode,
      itemName:
        pg.grocery?.itemName ??
        "Unknown",
    }));

    res.json({
      PromotionId: promo.PromotionId,
      ChainId: promo.ChainId,
      SubChainId: promo.SubChainId,
      StoreId: promo.StoreId,
      PromotionName: promo.PromotionName ?? null,
      groceries,
    });
  } catch (error) {
    console.error("Error fetching discounted groceries:", error);
    next(error);
  }
};

// get promotions by store
export const getPromotionsByStoreController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { chainId, subChainId, storeId } = req.params;

  try {
    const promotions = await getPromotionsByStore(chainId, subChainId, storeId);
    res.json(promotions);
  } catch (error) {
    console.error("Error fetching store promotions:", error);
    next(error);
  }
};


// get promotions by grocery item code
export const getPromotionsByGroceryController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { itemCode } = req.params;

  try {
    const promotions = await getPromotionsByGroceryItemCode(itemCode);
    res.json(promotions);
  } catch (error) {
    console.error("Error fetching promotions for grocery:", error);
    next(error);
  }
};

// get promotions grouped by store
export const getPromotionsGroupedByStoreController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon, maxStoreDistance } = req.query;

    // Parse and validate query parameters
    let userLat: number | undefined;
    let userLon: number | undefined;
    let maxDistance: number | undefined;

    if (lat && lon) {
      userLat = parseFloat(String(lat));
      userLon = parseFloat(String(lon));

      // Validate that the parsed values are valid numbers
      if (isNaN(userLat) || isNaN(userLon)) {
        return res.status(400).json({
          message: "Invalid latitude or longitude values. Must be valid numbers."
        });
      }
    }

    if (maxStoreDistance) {
      maxDistance = parseFloat(String(maxStoreDistance));

      // Validate that the parsed value is a valid positive number
      if (isNaN(maxDistance) || maxDistance <= 0) {
        return res.status(400).json({
          message: "Invalid maxStoreDistance value. Must be a positive number."
        });
      }
    }

    const groupedPromos = await getPromotionsGroupedByStore(userLat, userLon, maxDistance);
    res.json(groupedPromos);
  } catch (error) {
    console.error("Error fetching grouped promotions:", error);
    next(error);
  }
};
