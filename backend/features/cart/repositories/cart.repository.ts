import prisma from "../../shared/prisma-client/prisma-client.js";
import { v4 as uuidv4 } from "uuid";

// get cart items by device id
export const getCartItemsByDeviceId = async (deviceId: string) => {
  return await prisma.cartItem.findMany({
    where: { deviceId },
    include: {
      grocery: {
        include: {
          store_grocery: {
            select: {
              itemPrice: true,
            },
          },
        },
      },
    },
  });
};


// add cart item
export const upsertCartItem = async (
  deviceId: string,
  itemCode: string,
  quantity: number
) => {
  return await prisma.cartItem.upsert({
    where: {
      deviceId_itemCode: { deviceId, itemCode },
    },
    update: { quantity },
    create: {
      id: uuidv4(), // or uuidv4()
      deviceId,
      itemCode,
      quantity,
    },
  });
};

// update cart item quantity
export const updateCartItemQuantity = async (
  deviceId: string,
  itemCode: string,
  quantity: number
) => {
  return await prisma.cartItem.update({
    where: {
      deviceId_itemCode: { deviceId, itemCode },
    },
    data: {
      quantity,
    },
  });
};

// increment cart item quantity
export const incrementCartItemQuantity = async (
  deviceId: string,
  itemCode: string,
  quantityToAdd: number
) => {
  // First get the current item to know its quantity
  const currentItem = await prisma.cartItem.findUnique({
    where: {
      deviceId_itemCode: { deviceId, itemCode },
    },
  });

  if (!currentItem) {
    throw new Error(`Cart item not found: ${itemCode}`);
  }

  // Calculate the new quantity (current + additional)
  const newQuantity = currentItem.quantity + quantityToAdd;

  // Update with the new total quantity
  return await prisma.cartItem.update({
    where: {
      deviceId_itemCode: { deviceId, itemCode },
    },
    data: {
      quantity: newQuantity,
    },
  });
};

// remove item from cart
export const removeCartItem = async (deviceId: string, itemCode: string) => {
  console.log(`Removing cart item: Device=${deviceId}, Item=${itemCode}`);
  
  return await prisma.cartItem.delete({
    where: {
      deviceId_itemCode: { deviceId, itemCode },
    },
  });
};