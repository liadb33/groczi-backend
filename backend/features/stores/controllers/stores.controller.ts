import { Request, Response, NextFunction } from 'express';
import { findAllStores, findStoreById } from '../repositories/stores.repository.js';

/**
 * Get all stores
 */
export const getAllStores = (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = findAllStores();
    res.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    next(error);
  }
};

/**
 * Get a store by ID
 */
export const getStoreById = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const store = findStoreById(id);
    
    if (!store) {
      return res.status(404).json({ message: `Store with ID ${id} not found` });
    }
    
    res.json(store);
  } catch (error) {
    console.error('Error fetching store by ID:', error);
    next(error);
  }
}; 