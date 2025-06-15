import prisma from "../../shared/prisma-client/prisma-client.js";
import { v4 as uuidv4 } from "uuid";
import {
    DPGroceryList,
    DPStoresData,
    DPPricesMatrix,
} from "../../shared/types/optimization.types.js";

// get cart items by device id
export const getCartItemsByDeviceId = async (deviceId: string) => {
  return await prisma.cart_item.findMany({
    where: { deviceId },
    orderBy: { createdAt: "asc" },
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
  return await prisma.cart_item.upsert({
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
  const currentItem = await prisma.cart_item.findFirst({
    where: { id: cartItemId, deviceId },
  });

  if (!currentItem) {
    throw new Error(`Cart item not found: ${cartItemId}`);
  }

  const newQuantity = currentItem.quantity + quantityDelta;

  if (newQuantity <= 0) {
    await prisma.cart_item.delete({
      where: { id: cartItemId },
    });
    return null;
  }

  return await prisma.cart_item.update({
    where: { id: cartItemId },
    data: { quantity: newQuantity },
  });
};



// remove item from cart
export const removeCartItem = async (deviceId: string, cartItemId: string) => {
 
  const item = await prisma.cart_item.findFirst({
    where: { id: cartItemId, deviceId },
  });

  if (!item) {
    throw new Error(`Cart item not found or unauthorized`);
  }
  return await prisma.cart_item.delete({
    where: { id: cartItemId },
  });
};

// --- NEW: Types for Optimization Data Fetching ---
export interface CartItemDetailForOptimization {
  itemCode: string;
  quantity: number;
  itemName: string;
}

export interface EligibleStoreForOptimization {
  storeId: string;
  storeName: string;
  address: string;
  city: string;
  location: [number, number];
  distanceKm: number;
  itemPrices: {
    [itemCode: string]: number;
  };
}
