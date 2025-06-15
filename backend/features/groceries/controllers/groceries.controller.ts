import { Request, Response, NextFunction } from 'express';
import { countGroceries, getAllGroceries, getGroceryByItemCode, getGroceryHistory, getStoresByItemCode, searchGroceries } from '../repositories/groceries.repository.js';

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

  try {
    const stores = await getStoresByItemCode(itemCode);

    if (!stores.length) {
      return res
        .status(404)
        .json({ message: "No stores found for this grocery item" });
    }

    const flattened = stores.map(({ stores: storeInfo, ...rest }) => ({
      ...rest,
      StoreName: storeInfo.StoreName,
      Address: storeInfo.Address,
      City: storeInfo.City,
      ZipCode: storeInfo.ZipCode,
      subchains: {
        imageUrl: storeInfo.subchains?.imageUrl || null,
        SubChainName: storeInfo.subchains?.SubChainName || null
      }
    }));

    const minPrice = Math.min(
      ...flattened.map((s) => Number(s.itemPrice)).filter((p) => !isNaN(p))
    );

    res.json({
      minPrice: minPrice.toFixed(2),
      stores: flattened,
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
