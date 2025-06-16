// src/node-importer/features/promotions/promotions.repository.ts
import prisma from "../prisma-client/prismaClient.js";
import { Promotion } from "../modules/promotions/promotion.entity.js";
import { findStoreByIds } from "./stores.repository.js";

export async function savePromotion(promo: Promotion) {
  // nothing to do if we don't have the full PK
  if (
    !promo.PromotionId ||
    promo.ChainId === undefined ||
    promo.SubChainId === undefined ||
    promo.StoreId === undefined
  ) {
    return false;
  }

  const store = await findStoreByIds({
    ChainId: promo.ChainId,
    SubChainId: promo.SubChainId,
    StoreId: promo.StoreId,
  });

  if (!store) {
    return false;
  }

  // STEP 1: Pre-validate which grocery items can be saved
  const validGroceryItems = [];
  
  for (let i = 0; i < promo.groceryItems.length; i++) {
    const groceryItem = promo.groceryItems[i];
    
    // skip if no itemCode
    if (!groceryItem.itemCode) continue;

    // Check if this grocery item exists in store_grocery
    const grocery = await prisma.store_grocery.findFirst({
      where: {
        itemCode: groceryItem.itemCode,
      },
      select: {
        StoreId: true,
      },
    });
    
    if (grocery) {
      validGroceryItems.push(groceryItem);
    }
  }

  // STEP 2: Only save promotion if it has at least one valid grocery item
  if (validGroceryItems.length === 0) {
    return false;
  }


  // STEP 3: Save the promotion (only if we have valid groceries)
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

  // STEP 4: Save only the valid grocery items
  for (const groceryItem of validGroceryItems) {
    await prisma.promotion_grocery.upsert({
      where: {
        // composite PK (PromotionId,ChainId,SubChainId,StoreId,itemCode)
        PromotionId_ChainId_SubChainId_StoreId_itemCode: {
          PromotionId: promo.PromotionId,
          ChainId: promo.ChainId,
          SubChainId: promo.SubChainId,
          StoreId: promo.StoreId,
          itemCode: groceryItem.itemCode,
        },
      },
      update: {
        DiscountPrice: groceryItem.DiscountPrice,
      },
      create: {
        PromotionId: promo.PromotionId,
        ChainId: promo.ChainId,
        SubChainId: promo.SubChainId,
        StoreId: promo.StoreId,
        itemCode: groceryItem.itemCode,
        DiscountPrice: groceryItem.DiscountPrice,
      },
    });
  }

  return true;
}
