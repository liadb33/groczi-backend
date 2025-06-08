import prisma from "../../shared/prisma-client/prisma-client.js";
import { v4 as uuidv4 } from "uuid";

// get grocery lists by device id
export const getListsByDeviceId = async (deviceId: string) => {
  return await prisma.grocery_list.findMany({
    where: { deviceId },
    orderBy: { createdAt: "asc" },
    include: {
      list_item: {
        include: {
          grocery: {
            include: {
              store_grocery: {
                select: { itemPrice: true },
              },
            },
          },
        },
      },
    },
  });
};

// create grocery list
export const createGroceryList = async (deviceId: string, name: string) => {
  return await prisma.grocery_list.create({
    data: {
      id: uuidv4(),
      name,
      deviceId,
    },
  });
};

// Fetch a list by ID
export const getListById = async (listId: string) => {
  return await prisma.grocery_list.findUnique({
    where: { id: listId },
  });
};

// Create a new list item
export const createListItem = async (
  listId: string,
  itemCode: string,
  quantity: number
) => {
  return await prisma.list_item.create({
    data: {
      id: uuidv4(),
      listId,
      itemCode,
      quantity,
    },
  });
};


// get list details
export const getListWithItems = async (listId: string) => {
  return await prisma.grocery_list.findUnique({
    where: { id: listId },
    include: {
      list_item: {
        orderBy: { createdAt: "asc" },
        include: {
          grocery: {
            include: {
              store_grocery: {
                select: { itemPrice: true },
              },
            },
          },
        },
      },
    },
  });
};

// update list name
export const updateListName = async (listId: string, name: string) => {
  return await prisma.grocery_list.update({
    where: { id: listId },
    data: { name },
  });
};

// delete lists by ids
export const deleteListsByIds = async (deviceId: string, listIds: string[]) => {
  const result = await prisma.grocery_list.deleteMany({
    where: {
      id: { in: listIds },
      deviceId, // ensure device scoping
    },
  });

  return result.count; // number of deleted rows
};


// Delete a specific item from a list
export const deleteListItem = async (listId: string, itemCode: string) => {
  return await prisma.list_item.deleteMany({
    where: {
      listId,
      itemCode,
    },
  });
};


export const updateListItemQuantity = async (
  deviceId: string,
  listId: string,
  itemCode: string,
  quantityDelta: number
) => {
  const currentItem = await prisma.list_item.findFirst({
    where: { listId, itemCode, grocery_list: { deviceId } },
  });

  if (!currentItem) {
    throw new Error(`List item not found: ${itemCode}`);
  }

  const newQuantity = currentItem.quantity + quantityDelta;

  if (newQuantity <= 0) {
    await prisma.list_item.delete({
      where: { id: currentItem.id },
    });
    return null;
  }

  return await prisma.list_item.update({
    where: { id: currentItem.id },
    data: { quantity: newQuantity },
  });
};
