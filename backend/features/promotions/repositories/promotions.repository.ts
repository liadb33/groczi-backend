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


export const getPromotionsGroupedByStore = async () => {
  // Fetch all promotions including store info
  const promos = await prisma.promotion.findMany({
    include: {
      stores: true, 
    },
    take: 5,
  });

  // Group promotions by store key (chainId-subChainId-storeId)
  const grouped = promos.reduce((acc: any, promo: any) => {
    const key = `${promo.ChainId}-${promo.SubChainId}-${promo.StoreId}`;
    if (!acc[key]) {
      acc[key] = {
        chainId: promo.ChainId,
        subChainId: promo.SubChainId,
        storeId: promo.StoreId,
        storeName: promo.stores?.StoreName || null,
        address: promo.stores?.Address || null,
        city: promo.stores?.City || null,
        zipcode: promo.stores?.Zipcode || null,
        latitude: promo.stores?.Latitude || null,
        longitude: promo.stores?.Longitude || null,
        promotions: [],
      };
    }
    acc[key].promotions.push({
      promotionId: promo.PromotionId,
      promotionName: promo.PromotionName,
      startDate: promo.StartDate,
      endDate: promo.EndDate,
    });
    return acc;
  }, {});

  // Return as array
  return Object.values(grouped);
};
