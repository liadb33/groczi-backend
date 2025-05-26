import { RequestHandler, Router } from "express";
import { 
  optimizeSingleStoreForListController,
  optimizeMultiStoreForListController,
} from "../controllers/optimization.controller.js";
import { ensureDeviceUser } from "../../shared/middleware/ensureDeviceUser.js";

const optimizationRoute = Router();

optimizationRoute.post(
    "/single-store",
    optimizeSingleStoreForListController as RequestHandler
);


optimizationRoute.post(
    "/multi-store",
    optimizeMultiStoreForListController as RequestHandler
);

export default optimizationRoute; 