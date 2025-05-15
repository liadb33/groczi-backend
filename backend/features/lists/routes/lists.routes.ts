 import { RequestHandler, Router } from "express";
 import { addListItemController, createListController, deleteListItemController, deleteListsController, getListDetailController, getListsController, updateListNameController } from "../controllers/lists.controller.js";
import { ensureDeviceUser } from "../../shared/middleware/ensureDeviceUser.js";

const listsRoute = Router();

listsRoute.use(ensureDeviceUser);

// GET /me/lists
listsRoute.get("/", getListsController);

// POST /me/lists
listsRoute.post("/", createListController as RequestHandler);

//  GET /me/lists/:listId 
listsRoute.get("/:listId", getListDetailController as RequestHandler);

// PUT /me/lists/:listId 
listsRoute.put("/:listId", updateListNameController as RequestHandler);

// DELETE /me/lists 
listsRoute.delete("/", deleteListsController as RequestHandler);

// POST /me/lists/:listId/items
listsRoute.post("/:listId/items", addListItemController as RequestHandler);

// DELETE /me/lists/:listId/items/:listItemId
listsRoute.delete("/:listId/items/:itemCode", deleteListItemController as RequestHandler);


 export default listsRoute;
