import prisma from "../../shared/prisma-client/prisma-client.js";


// get all promotions
export const getAllPromotions = async () => {
  return await prisma.promotion.findMany();
};

// get promotion by id
export const getDiscountedGroceriesByPromotionId = async (
  promotionId: string,
  chainId: string,
  subChainId: string,
  storeId: string
) => {
  return await prisma.promotion_grocery.findMany({
    where: {
      PromotionId: promotionId,
      ChainId: chainId,
      SubChainId: subChainId,
      StoreId: storeId,
    },
    include: {
      grocery: true, // include grocery details
    },
  });
};

// get promotions by store
export const getPromotionsByStore = async (
  chainId: string,
  subChainId: string,
  storeId: string
) => {
  return await prisma.promotion.findMany({
    where: {
      ChainId: chainId,
      SubChainId: subChainId,
      StoreId: storeId,
    },
    include: {
      promotion_grocery: true, // optional: include groceries in the promo
    },
  });
};

// get promotions by grocery item code
export const getPromotionsByGroceryItemCode = async (itemCode: string) => {
  return await prisma.promotion_grocery.findMany({
    where: { itemCode },
    include: {
      promotion: true,
    },
  });
};

