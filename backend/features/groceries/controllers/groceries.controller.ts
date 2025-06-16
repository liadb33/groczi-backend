import { Request, Response, NextFunction } from 'express';
import { countGroceries, getAllGroceries, getGroceryByItemCode, getGroceryHistory, getStoresByItemCode, searchGroceries } from '../repositories/groceries.repository.js';
import prisma from '../../shared/prisma-client/prisma-client.js';
import { calculateDistance } from '../../shared/utils/distance.utils.js';

/**
 * Handles the request to get the list of groceries.
 */
export const getAllGroceriesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const minPrice = req.query.minPrice
      ? Number(req.query.minPrice)
      : undefined;
    const maxPrice = req.query.maxPrice
      ? Number(req.query.maxPrice)
      : undefined;
    const company = req.query.company ? String(req.query.company) : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const result = await getAllGroceries(
      minPrice,
      maxPrice,
      company,
      page,
      limit
    );
    res.json(result);
  } catch (error) {
    console.error("Error fetching groceries:", error);
    next(error);
  }
};


//get grocery by id
export const getGroceryByItemCodeController = async (req: Request, res: Response) => {
  const { itemCode } = req.params;

  try {
    const grocery = await getGroceryByItemCode(itemCode);

    if (!grocery) {
      return res.status(404).json({ message: "Grocery not found" });
    }

    res.json(grocery);
  } catch (error) {
    console.error("Error fetching grocery:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


//get stores by grocery item code
export const getStoresByGroceryItemCodeController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id: itemCode } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Get user coordinates if provided
  const userLatitude = req.query.userLatitude ? parseFloat(req.query.userLatitude as string) : undefined;
  const userLongitude = req.query.userLongitude ? parseFloat(req.query.userLongitude as string) : undefined;
  
  // Check if both coordinates are provided and valid
  const hasValidCoordinates = 
    userLatitude !== undefined && 
    userLongitude !== undefined && 
    !isNaN(userLatitude) && 
    !isNaN(userLongitude) &&
    userLatitude >= -90 && userLatitude <= 90 &&
    userLongitude >= -180 && userLongitude <= 180;

  try {
    const result = await getStoresByItemCode(
      itemCode, 
      page, 
      limit, 
      hasValidCoordinates ? userLatitude : undefined,
      hasValidCoordinates ? userLongitude : undefined
    );

    if (!result.data.length && page === 1) {
      return res
        .status(404)
        .json({ message: "No stores found for this grocery item" });
    }

    // Flatten and calculate distances if coordinates are provided
    let processedStores: any[] = result.data.map(({ stores: storeInfo, ...rest }) => {
      const baseStore = {
        ...rest,
        StoreName: storeInfo.StoreName,
        Address: storeInfo.Address,
        City: storeInfo.City,
        Latitude: storeInfo.Latitude,
        Longitude: storeInfo.Longitude,
        subchains: {
          imageUrl: storeInfo.subchains?.imageUrl || null,
          SubChainName: storeInfo.subchains?.SubChainName || null
        }
      };

      // Add distance if user coordinates are provided and store has coordinates
      if (hasValidCoordinates && 
          storeInfo.Latitude !== null && 
          storeInfo.Longitude !== null &&
          !isNaN(storeInfo.Latitude) &&
          !isNaN(storeInfo.Longitude)) {
        const distance = calculateDistance(
          userLatitude!,
          userLongitude!,
          storeInfo.Latitude,
          storeInfo.Longitude
        );
        return { ...baseStore, distance };
      }

      return baseStore;
    });

    // Sort by distance if coordinates are provided, otherwise keep price order
    if (hasValidCoordinates) {
      processedStores = processedStores.sort((a: any, b: any) => {
        // If both have distance, sort by distance
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        // If only one has distance, prioritize the one with distance
        if (a.distance !== undefined && b.distance === undefined) {
          return -1;
        }
        if (a.distance === undefined && b.distance !== undefined) {
          return 1;
        }
        // If neither has distance, sort by price
        return Number(a.itemPrice || 0) - Number(b.itemPrice || 0);
      });
    }

    // Apply pagination if we sorted by distance
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStores = hasValidCoordinates ? 
      processedStores.slice(startIndex, endIndex) : 
      processedStores;

    // Get minimum price across all stores (not just current page)
    const allStoresForMinPrice = await prisma.store_grocery.findMany({
      where: { itemCode },
      select: { itemPrice: true }
    });

    const minPrice = allStoresForMinPrice.length > 0 
      ? Math.min(...allStoresForMinPrice.map((s: any) => Number(s.itemPrice)).filter((p: number) => !isNaN(p)))
      : 0;

    res.json({
      minPrice: minPrice.toFixed(2),
      stores: paginatedStores,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      hasNextPage: page < result.totalPages,
      hasPrevPage: page > 1,
      locationBasedSorting: hasValidCoordinates, // Flag indicating if distance-based sorting was applied
      userCoordinatesProvided: hasValidCoordinates,
    });
  } catch (error) {
    console.error("Error fetching stores by itemCode:", error);
    next(error);
  }
};

// search groceries
export const searchGroceriesController = async (
  req: Request,
  res: Response
) => {
  const query = req.query.q as string;
  const page = parseInt(req.query.page as string) || 1; // default page 1
  const limit = parseInt(req.query.limit as string) || 10; // default 10 items per page

  if (!query || query.trim() === "") {
    return res.status(400).json({ message: "Missing query parameter" });
  }

  try {
    const results = await searchGroceries(query, page, limit);

    // Optionally, get total count for frontend pagination UI
    const totalCount = await countGroceries(query);

    res.json({
      data: results,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Autocomplete search failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export async function getPriceHistoryController(req: Request, res: Response) {
  const { itemCode } = req.params;

  try {
    const priceHistory = await getGroceryHistory(itemCode);

    const grouped: Record<
      string,
      {
        store_id: string;
        store_name: string;
        prices: { date: string; price: number }[];
      }
    > = {};

    priceHistory.forEach(({ StoreId, price, updateDatetime, stores }) => {
      if (!grouped[StoreId]) {
        grouped[StoreId] = {
          store_id: StoreId,
          store_name: stores?.StoreName ?? "Unknown",
          prices: [],
        };
      }

      grouped[StoreId].prices.push({
        date: updateDatetime.toISOString(),
        price: Number(price),
      });
    });

    res.json({
      itemCode,
      price_history: Object.values(grouped),
    });

  } catch (error) {
    console.error("Error fetching price history:", error);
    res.status(500).json({ error: "Failed to fetch price history" });
  }
}
