import { Request, Response, NextFunction } from 'express';
import { findAllGroceries } from '../repositories/groceries.repository.js';

/**
 * Handles the request to get the list of groceries.
 */
export const getGroceriesHandler = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get groceries directly from repository
    const groceries = findAllGroceries();
    res.json(groceries);
  } catch (error) {
    console.error('Error fetching groceries:', error);
    next(error); // Pass to Express error handler
  }
};
