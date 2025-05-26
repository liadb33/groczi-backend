import { RequestHandler, Router } from 'express';
import {
  getAllGroceriesController,
  getGroceryByItemCodeController,
  getStoresByGroceryItemCodeController,
  searchGroceriesController,
  getPriceHistoryController,
} from "../controllers/groceries.controller.js";

// Create a router
const groceriesRoute = Router();

// GET /groceries
groceriesRoute.get('/', getAllGroceriesController);
groceriesRoute.get('/search', searchGroceriesController as RequestHandler);
groceriesRoute.get("/:itemCode", getGroceryByItemCodeController as RequestHandler); 
groceriesRoute.get('/:id/stores', getStoresByGroceryItemCodeController as RequestHandler); 
groceriesRoute.get("/:itemCode/price-history", getPriceHistoryController);
// Add other grocery routes here if needed
export default groceriesRoute;
