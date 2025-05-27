import { Request, Response, NextFunction } from 'express';
import { findAllStores, findStoreById, getNearbyStoresFromLocation } from '../repositories/stores.repository.js';

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


// get nearby stores
export const getNearbyStores = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userLatitude, userLongitude, maxStoreDistance, limit } = req.query;

  if (!userLatitude || !userLongitude || !maxStoreDistance) {
    return res.status(400).json({
      message: "Missing userLatitude, userLongitude, or maxStoreDistance",
    });
  }

  try {
    const stores = await getNearbyStoresFromLocation(
      parseFloat(userLatitude as string),
      parseFloat(userLongitude as string),
      parseFloat(maxStoreDistance as string),
      parseInt(limit as string) || 5
    );

    res.json(stores);
  } catch (error) {
    console.error("Error fetching nearby stores:", error);
    next(error);
  }
};