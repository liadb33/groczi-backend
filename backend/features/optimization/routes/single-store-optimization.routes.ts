import { RequestHandler, Router } from "express";
import { 
  optimizeSingleStoreForListController,
} from "../controllers/single-store-optimization.controller.js";

const singleStoreOptimizationRoute = Router();

singleStoreOptimizationRoute.post(
    "/",
    optimizeSingleStoreForListController as RequestHandler
);

export default singleStoreOptimizationRoute; 