import { Router, RequestHandler } from "express";
import {
  getAllStores,
  getStoreById,
} from "../controllers/stores.controller.js";

const storesRoute = Router();

// GET /api/v1/stores - Get all stores
storesRoute.get("/", getAllStores as RequestHandler);

// GET /api/v1/stores/:id - Get store by ID
storesRoute.get("/:id", getStoreById as RequestHandler);

export default storesRoute;
