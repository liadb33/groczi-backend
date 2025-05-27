import { Router, RequestHandler } from "express";
import {
  getAllStores,
  getNearbyStores,
  getStoreById,
} from "../controllers/stores.controller.js";

const storesRoute = Router();

// GET /stores - Get all stores
storesRoute.get("/", getAllStores as RequestHandler);

// GET /stores/nearby - Get nearby stores
storesRoute.get("/nearby", getNearbyStores as RequestHandler);

// GET /stores/:id - Get store by ID
storesRoute.get("/:id", getStoreById as RequestHandler);



export default storesRoute;
