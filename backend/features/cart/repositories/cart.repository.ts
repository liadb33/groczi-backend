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
  cartItemId: string,
  quantityDelta: number
) => {
  const currentItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, deviceId },
  });

  if (!currentItem) {
    throw new Error(`Cart item not found: ${cartItemId}`);
  }

  const newQuantity = currentItem.quantity + quantityDelta;

  if (newQuantity <= 0) {
    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });
    return null;
  }

  return await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: newQuantity },
  });
};



// remove item from cart
export const removeCartItem = async (deviceId: string, cartItemId: string) => {
 
  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, deviceId },
  });

  if (!item) {
    throw new Error(`Cart item not found or unauthorized`);
  }
  return await prisma.cartItem.delete({
    where: { id: cartItemId },
  });
};
