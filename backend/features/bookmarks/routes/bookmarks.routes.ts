import { RequestHandler, Router } from "express";
import {
  getBookmarksController,
  deleteBookmarkController,
  addBookmarkController
} from "../controllers/bookmarks.controller.js";
import { ensureDeviceUser } from "../../shared/middleware/ensureDeviceUser.js";


const bookmarksRoute = Router();

// Apply deviceId middleware to all /me/bookmarks routes
bookmarksRoute.use(ensureDeviceUser );

// GET /me/bookmarks
bookmarksRoute.get("/", getBookmarksController as RequestHandler);

// DELETE /me/bookmarks/:itemCode
bookmarksRoute.delete("/:itemCode", deleteBookmarkController as RequestHandler);

// POST /me/bookmarks
bookmarksRoute.post("/", addBookmarkController as RequestHandler);

export default bookmarksRoute;
