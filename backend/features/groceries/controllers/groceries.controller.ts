import { Request, Response, NextFunction } from 'express';
import { getAllGroceries, getGroceryByItemCode, getStoresByItemCode, searchGroceries } from '../repositories/groceries.repository.js';

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

