import { RequestHandler, Router } from 'express';
import {
  getAllCategoriesController,
  getGroceriesByCategoriesController,
  getGroceriesCountByCategoryController,
} from "../controllers/categories.controller.js";

// Create a router
const categoriesRoute = Router();

// GET /categories - Get all available categories
categoriesRoute.get('/', getAllCategoriesController);

// GET /categories/:category/count - Get count of groceries in a specific category
categoriesRoute.get('/:category/count', getGroceriesCountByCategoryController as RequestHandler);

export default categoriesRoute; 