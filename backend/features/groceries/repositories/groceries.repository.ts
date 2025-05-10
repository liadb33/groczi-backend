
import prisma from "../../shared/prisma-client/prisma-client.js";


export const getAllGroceries = async () => {
  return await prisma.grocery.findMany();
};


export const getGroceryByItemCode = async (itemCode: string) => {
  return await prisma.grocery.findUnique({
    where: { itemCode },
  });
};


export const getStoresByItemCode = async (itemCode: string) => {
  return await prisma.store_grocery.findMany({
    where: { itemCode },
    include: {
      stores: true, // This pulls the full store data
    },
  });
};