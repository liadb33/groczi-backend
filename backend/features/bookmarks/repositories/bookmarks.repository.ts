import prisma from "../../shared/prisma-client/prisma-client.js";
import { v4 as uuidv4 } from "uuid";

// get bookmarks by device id
export const getBookmarksByDeviceId = async (deviceId: string) => {
  return await prisma.bookmark.findMany({
    where: { deviceId },
    include: {
      grocery: true, // Include grocery details
    },
  });
};

// delete bookmark by device id and item code
export const deleteBookmark = async (deviceId: string, itemCode: string) => {
  return await prisma.bookmark.deleteMany({
    where: {
      deviceId,
      itemCode,
    },
  });
};

// create a new bookmark
export const createBookmark = async (deviceId: string, itemCode: string) => {
  // Check if bookmark already exists
  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      deviceId,
      itemCode,
    },
  });

  // If already bookmarked, just return it
  if (existingBookmark) {
    return existingBookmark;
  }

  // Create new bookmark with unique ID
  return await prisma.bookmark.create({
    data: {
      id: uuidv4(),
      deviceId,
      itemCode,
    },
  });
};
