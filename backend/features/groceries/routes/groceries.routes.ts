import { RequestHandler, Router } from 'express';
import {
  getAllGroceriesController,
  getGroceryByItemCodeController,
  getStoresByGroceryItemCodeController,
  searchGroceriesController,
  getPriceHistoryController,
} from "../controllers/groceries.controller.js";
import {
  getGroceriesByCategoriesController,
} from "../controllers/categories.controller.js";
import categoriesRoute from './categories.routes.js';

// Create a router
const groceriesRoute = Router();

// GET /groceries
groceriesRoute.get('/', getAllGroceriesController);
groceriesRoute.get('/search', searchGroceriesController as RequestHandler);

// GET /groceries/by-category - Get groceries by category/categories
// Query params: category (required), page (optional), limit (optional)
// Example: /groceries/by-category?category=פירות וירקות
// Example: /groceries/by-category?category=פירות וירקות|בשר ודגים&page=1&limit=20
groceriesRoute.get('/by-category', getGroceriesByCategoriesController as RequestHandler);

// Categories routes - must come before dynamic routes
groceriesRoute.use('/categories', categoriesRoute);

// Dynamic routes (these should come after specific routes)
groceriesRoute.get("/:itemCode", getGroceryByItemCodeController as RequestHandler); 
groceriesRoute.get('/:id/stores', getStoresByGroceryItemCodeController as RequestHandler); 
groceriesRoute.get("/:itemCode/price-history", getPriceHistoryController);

// Add other grocery routes here if needed
export default groceriesRoute;
