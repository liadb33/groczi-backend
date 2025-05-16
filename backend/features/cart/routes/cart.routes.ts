import { RequestHandler, Router } from "express";
import { 
 addCartItemController, 
 getCartController,
 removeCartItemController,
 updateCartItemController
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

export default cartRoute;
