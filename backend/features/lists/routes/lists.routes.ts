 import { Router } from "express";
 import { getGroceryListsController } from "../controllers/lists.controller.js";
import { ensureDeviceUser } from "../../shared/middleware/ensureDeviceUser.js";

 const listsRoute = Router();

 listsRoute.use(ensureDeviceUser);

 // GET /me/lists
 listsRoute.get("/", getGroceryListsController);

 export default listsRoute;
