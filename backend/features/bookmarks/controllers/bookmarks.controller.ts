import { Request, Response, NextFunction } from "express";
import { getBookmarksByDeviceId, deleteBookmark, createBookmark } from "../repositories/bookmarks.repository.js";

// Helper function to map bookmarks to client-friendly response
const mapBookmarksToResponse = (bookmarks: any[]) => {
  return bookmarks.map((bookmark) => {
    const grocery = bookmark.grocery;

    const prices =
      grocery?.store_grocery
        ?.map((p: any) => Number(p.itemPrice))
        .filter(Boolean) ?? [];

    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

    return {
      id: bookmark.id,
      itemCode: bookmark.itemCode,
      itemName:
        grocery?.itemName ??
        grocery?.manufacturerItemDescription ??
        "Unknown",
      price: minPrice.toFixed(2),
      unitQty: grocery?.unitQty,
      quantity: grocery?.quantity,
      isWeighted: grocery?.isWeighted,
      qtyInPackage: grocery?.qtyInPackage,
    };
  });
};

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
    const bookmarks = await getBookmarksByDeviceId(deviceId);
    const response = mapBookmarksToResponse(bookmarks);
    res.json(response);
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
    
    // Return updated bookmarks list
    const updatedBookmarks = await getBookmarksByDeviceId(deviceId);
    const response = mapBookmarksToResponse(updatedBookmarks);
    res.json(response);
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
    
    // Return updated bookmarks list
    const updatedBookmarks = await getBookmarksByDeviceId(deviceId);
    const response = mapBookmarksToResponse(updatedBookmarks);
    res.json(response);
  } catch (error) {
    console.error("Error adding bookmark:", error);
    next(error);
  }
};
