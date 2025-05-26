import { Request, Response, NextFunction } from 'express';
import { getAllGroceries, getGroceryByItemCode, getGroceryHistory, getStoresByItemCode, searchGroceries } from '../repositories/groceries.repository.js';

/**
 * Handles the request to get the list of groceries.
 */
export const getAllGroceriesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get groceries directly from repository
    const groceries = await getAllGroceries();
    res.json(groceries);
  } catch (error) {
    console.error('Error fetching groceries:', error);
    next(error); // Pass to Express error handler
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

    res.json(stores);
  } catch (error) {
    console.error("Error fetching stores by itemCode:", error);
    next(error);
  }
};

// search groceries
export const searchGroceriesController = async (req: Request, res: Response) => {
  const query = req.query.q as string;

  if (!query || query.trim() === "") {
    return res.status(400).json({ message: "Missing query parameter" });
  }

  try {
    const results = await searchGroceries(query);
    res.json(results);
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
