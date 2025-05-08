// src/node-importer/features/promotions/promotions.repository.ts
import prisma from "../prisma-client/prismaClient.js";
import { Promotion } from "../modules/promotions/promotion.entity.js";

export async function savePromotion(promo: Promotion) {
  // nothing to do if we don't have the full PK
  if (
    !promo.PromotionId ||
    promo.ChainId === undefined ||
    promo.SubChainId === undefined ||
    promo.StoreId === undefined
  ) {
    return;
  }
  const store = await prisma.stores.findFirst({
    where: {
      ChainId: promo.ChainId,
      SubChainId: promo.SubChainId,
      StoreId: promo.StoreId,
    },
    select: {
      StoreName: true,
      Address: true,
      City: true,
      ZipCode: true,
    },
  });
  if (!store) {
    console.error(
      `Store not found for ChainId: ${promo.ChainId}, SubChainId: ${promo.SubChainId}, StoreId: ${promo.StoreId}`
    );
    return;
  }

  // 1) Upsert into `promotion` using its composite PK (PromotionId,ChainId,SubChainId,StoreId)
  await prisma.promotion.upsert({
    where: {
      // THIS must match exactly the auto‐generated name in prisma client
      PromotionId_ChainId_SubChainId_StoreId: {
        PromotionId: promo.PromotionId,
        ChainId: promo.ChainId,
        SubChainId: promo.SubChainId,
        StoreId: promo.StoreId,
      },
    },
    update: {
      PromotionName: promo.PromotionName,
      StartDate: promo.StartDate,
      EndDate: promo.EndDate,
    },
    create: {
      PromotionId: promo.PromotionId,
      ChainId: promo.ChainId,
      SubChainId: promo.SubChainId,
      StoreId: promo.StoreId,
      PromotionName: promo.PromotionName,
      StartDate: promo.StartDate,
      EndDate: promo.EndDate,
    },
  });

  // 2) For each groceryItem, upsert into `promotion_grocery`
  for (let i = 0; i < promo.groceryItems.length; i++) {
    // skip if no itemCode
    if (!promo.groceryItems[i].itemCode) continue;

    const grocery = await prisma.store_grocery.findFirst({
      where: {
        itemCode: promo.groceryItems[i].itemCode,
      },
      select: {
        StoreId: true,
      },
    });
    if (!grocery) {
      console.error(
        `Grocery not found for itemCode: ${promo.groceryItems[i].itemCode}`
      );
      continue;
    }

    await prisma.promotion_grocery.upsert({
      where: {
        // composite PK (PromotionId,ChainId,SubChainId,StoreId,itemCode)
        PromotionId_ChainId_SubChainId_StoreId_itemCode: {
          PromotionId: promo.PromotionId,
          ChainId: promo.ChainId,
          SubChainId: promo.SubChainId,
          StoreId: promo.StoreId,
          itemCode: promo.groceryItems[i].itemCode,
        },
      },
      update: {
        DiscountPrice: promo.groceryItems[i].DiscountPrice,
      },
      create: {
        PromotionId: promo.PromotionId,
        ChainId: promo.ChainId,
        SubChainId: promo.SubChainId,
        StoreId: promo.StoreId,
        itemCode: promo.groceryItems[i].itemCode,
        DiscountPrice: promo.groceryItems[i].DiscountPrice,
      },
    });
  }
}
