import { Request, Response, NextFunction } from "express";
import { getBookmarksByDeviceId, deleteBookmark, createBookmark } from "../repositories/bookmarks.repository.js";


// get bookmarks for a device user
export const getBookmarksController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId;
  if (!deviceId) {
    return res.status(400).json({ message: "Device ID not found" });
  }

  try {
    // Then use deviceId as normal
    const bookmarks = await getBookmarksByDeviceId(deviceId);

    //Optional: map only grocery info if needed
    const groceries = bookmarks.map((b) => b.grocery);

    res.json(groceries);
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    next(error);
  }
};

// delete a bookmark
export const deleteBookmarkController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId;
  if (!deviceId) {
    return res.status(400).json({ message: "Device ID not found" });
  }

  const { itemCode } = req.params;
  
  try {
    await deleteBookmark(deviceId, itemCode);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting bookmark:", error);
    next(error);
  }
};

// add a bookmark
export const addBookmarkController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId;
  if (!deviceId) {
    return res.status(400).json({ message: "Device ID not found" });
  }

  const { itemCode } = req.body;
  
  if (!itemCode) {
    return res.status(400).json({ message: "itemCode is required" });
  }

  try {
    await createBookmark(deviceId, itemCode);
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding bookmark:", error);
    next(error);
  }
};
