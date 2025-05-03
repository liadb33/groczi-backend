// src/node-importer/features/promotions/promotions.repository.ts
import prisma from "../../database/prismaClient.js";
import { Promotion } from "./promotion.entity.js";

export async function savePromotion(promo: Promotion) {
  // אם אין PromotionId, לא שומרים כלום
  if (!promo.PromotionId) return;

  // 1. Upsert לטבלת promotions
  await prisma.promotion.upsert({
    where: { PromotionId: promo.PromotionId },
    update: {
      PromotionName: promo.PromotionName,
      StartDate: promo.StartDate,
      EndDate: promo.EndDate,
    },
    create: {
      PromotionId: promo.PromotionId,
      PromotionName: promo.PromotionName,
      StartDate: promo.StartDate,
      EndDate: promo.EndDate,
    },
  });

  for (const item of promo.groceryItems) {
    await prisma.promotion_grocery.upsert({
      where: {
        PromotionId_itemCode: {
          PromotionId: promo.PromotionId,
          itemCode: item.itemCode,
        },
      },
      update: {
        DiscountPrice: item.DiscountPrice,
      },
      create: {
        PromotionId: promo.PromotionId,
        itemCode: item.itemCode,
        DiscountPrice: item.DiscountPrice,
      },
    });
  }
}
