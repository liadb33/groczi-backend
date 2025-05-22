 import { Router, RequestHandler } from "express";
 import { getAllPromotionsController, getDiscountedGroceriesController, getPromotionsByGroceryController, getPromotionsByStoreController, getPromotionsSummaryController } from "../controllers/promotions.controller.js";

 const promotionsRoute = Router();

 // get all promotions
 promotionsRoute.get("/", getAllPromotionsController);

 // get discounted groceries by promotion id
 promotionsRoute.get("/:promotionId/discounted-groceries",
   getDiscountedGroceriesController as RequestHandler); 

// get promotions by store
promotionsRoute.get( "/store/:chainId/:subChainId/:storeId",getPromotionsByStoreController as RequestHandler);

// get promotions by grocery item code
promotionsRoute.get("/grocery/:itemCode", getPromotionsByGroceryController as RequestHandler);

// get promotions summary
promotionsRoute.get("/summary", getPromotionsSummaryController as RequestHandler);


 export default promotionsRoute;
