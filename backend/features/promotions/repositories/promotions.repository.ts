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
  return await prisma.promotion.findUnique({
    where: {
      PromotionId_ChainId_SubChainId_StoreId: {
        PromotionId: promotionId,
        ChainId: chainId,
        SubChainId: subChainId,
        StoreId: storeId,
      },
    },
    include: {
      promotion_grocery: {
        include: {
          grocery: true,
        },
      },
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


// get promotions summary
export const getPromotionsSummary = async () => {
  return await prisma.promotion.findMany({
    include: {
      stores: true, // to get the storeName
      promotion_grocery: {
        include: {
          grocery: true,
        },
        take: 4, // max 4 groceries
      },
    },
    take: 4,
  });
};