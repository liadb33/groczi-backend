import { RequestHandler, Router } from "express";
import { 
 addCartItemController, 
 getCartController,
 removeCartItemController,
 updateCartItemController,
 optimizeAndRankStoresForCartController,
 optimizeMultiStoreCartController,
} from "../controllers/cart.controller.js";
import { ensureDeviceUser } from "../../shared/middleware/ensureDeviceUser.js";

const cartRoute = Router();

cartRoute.use(ensureDeviceUser);

// GET /me/cart
cartRoute.get("/", getCartController);

// POST /me/cart/items
cartRoute.post("/items", addCartItemController as RequestHandler);

// PUT /me/cart/items/:cartItemId
cartRoute.put("/items/:cartItemId", updateCartItemController as RequestHandler);

// DELETE /me/cart/items/:cartItemId
cartRoute.delete("/items/:cartItemId", removeCartItemController as RequestHandler);

// POST /me/cart/optimize-single-store
cartRoute.post("/optimize-single-store", optimizeAndRankStoresForCartController as RequestHandler);

// POST /me/cart/optimize-multi-store
cartRoute.post("/optimize-multi-store", optimizeMultiStoreCartController as RequestHandler);

export default cartRoute;
