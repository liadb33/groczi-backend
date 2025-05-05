// src/node-importer/features/promotions/promotions.repository.ts
import prisma from "../../database/prismaClient.js";
import { Promotion } from "./promotion.entity.js";

export async function savePromotion(promo: Promotion) {
  // nothing to do if we don't have the full PK
  if (
    !promo.PromotionId ||
    promo.chainId === undefined ||
    promo.SubChainId === undefined ||
    promo.StoreId === undefined
  ) {
    return;
  }

  // 1) Upsert into `promotion` using its composite PK (PromotionId,ChainId,SubChainId,StoreId)
  await prisma.promotion.upsert({
    where: {
      // THIS must match exactly the auto‐generated name in prisma client
      PromotionId_ChainId_SubChainId_StoreId: {
        PromotionId: promo.PromotionId,
        ChainId: promo.chainId,
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
      ChainId: promo.chainId,
      SubChainId: promo.SubChainId,
      StoreId: promo.StoreId,
      PromotionName: promo.PromotionName,
      StartDate: promo.StartDate,
      EndDate: promo.EndDate,
    },
  });

  // 2) For each groceryItem, upsert into `promotion_grocery`
  for (const it of promo.groceryItems) {
    // skip if no itemCode
    if (!it.itemCode) continue;
    await prisma.promotion_grocery.upsert({
      where: {
        // composite PK (PromotionId,ChainId,SubChainId,StoreId,itemCode)
        PromotionId_ChainId_SubChainId_StoreId_itemCode: {
          PromotionId: promo.PromotionId,
          ChainId: promo.chainId,
          SubChainId: promo.SubChainId,
          StoreId: promo.StoreId,
          itemCode: it.itemCode,
        },
      },
      update: {
        DiscountPrice: it.DiscountPrice,
      },
      create: {
        PromotionId: promo.PromotionId,
        ChainId: promo.chainId,
        SubChainId: promo.SubChainId,
        StoreId: promo.StoreId,
        itemCode: it.itemCode,
        DiscountPrice: it.DiscountPrice,
      },
    });
  }
}
