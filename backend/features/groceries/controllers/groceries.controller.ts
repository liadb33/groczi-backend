import { Request, Response, NextFunction } from 'express';
import { getAllGroceries, getGroceryByItemCode, getStoresByItemCode } from '../repositories/groceries.repository.js';

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