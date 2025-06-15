import { RequestHandler, Router } from "express";
import { 
  optimizeMultiStoreForListController,
} from "../controllers/multi-store-optimization.controller.js";

const multiStoreOptimizationRoute = Router();

multiStoreOptimizationRoute.post(
    "/",
    optimizeMultiStoreForListController as RequestHandler
);

export default multiStoreOptimizationRoute; 