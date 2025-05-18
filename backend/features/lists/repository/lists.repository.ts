import prisma from "../../shared/prisma-client/prisma-client.js";
import { v4 as uuidv4 } from "uuid";

// get grocery lists by device id
export const getListsByDeviceId = async (deviceId: string) => {
  return await prisma.groceryList.findMany({
    where: { deviceId },
    orderBy: { createdAt: "asc" },
    include: {
      ListItem: {
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
  return await prisma.groceryList.create({
    data: {
      id: uuidv4(),
      name,
      deviceId,
    },
  });
};

// Fetch a list by ID
export const getListById = async (listId: string) => {
  return await prisma.groceryList.findUnique({
    where: { id: listId },
  });
};

// Create a new list item
export const createListItem = async (
  listId: string,
  itemCode: string,
  quantity: number
) => {
  return await prisma.listItem.create({
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
  return await prisma.groceryList.findUnique({
    where: { id: listId },
    include: {
      ListItem: {
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
  return await prisma.groceryList.update({
    where: { id: listId },
    data: { name },
  });
};

// delete lists by ids
export const deleteListsByIds = async (deviceId: string, listIds: string[]) => {
  const result = await prisma.groceryList.deleteMany({
    where: {
      id: { in: listIds },
      deviceId, // ensure device scoping
    },
  });

  return result.count; // number of deleted rows
};


// Delete a specific item from a list
export const deleteListItem = async (listId: string, itemCode: string) => {
  return await prisma.listItem.deleteMany({
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
  const currentItem = await prisma.listItem.findFirst({
    where: { listId, itemCode, GroceryList: { deviceId } },
  });

  if (!currentItem) {
    throw new Error(`List item not found: ${itemCode}`);
  }

  const newQuantity = currentItem.quantity + quantityDelta;

  if (newQuantity <= 0) {
    await prisma.listItem.delete({
      where: { id: currentItem.id },
    });
    return null;
  }

  return await prisma.listItem.update({
    where: { id: currentItem.id },
    data: { quantity: newQuantity },
  });
};
