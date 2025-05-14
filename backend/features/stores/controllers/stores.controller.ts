import { Request, Response, NextFunction } from 'express';
import { findAllStores, findStoreById } from '../repositories/stores.repository.js';

//get all stores
export const getAllStores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await findAllStores();
    res.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    next(error);
  }
};

//get store by id
export const getStoreById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const store = await findStoreById(id);

    if (!store) {
      return res.status(404).json({ message: `Store with ID ${id} not found` });
    }

    res.json(store);
  } catch (error) {
    console.error("Error fetching store by ID:", error);
    next(error);
  }
};