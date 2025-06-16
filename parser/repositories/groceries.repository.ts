import prisma from "../prisma-client/prismaClient.js";
import { GroceryReference } from "../modules/groceries/grocery.entity.js";
import { findStoreByIds } from "./stores.repository.js";

export async function saveGrocery(ref: GroceryReference) {
  const {
    itemCode,
    ChainId,
    SubChainId,
    StoreId,
    itemPrice,
    item,
    priceUpdate,
  } = ref;

  // 1. Upsert the Grocery master record (unchanged)
  await prisma.grocery.upsert({
    where: { itemCode },
    update: {
      itemName: item.itemName,
      manufacturerName: item.manufacturerName,
      unitQty: item.unitQty,
      unitOfMeasure: item.unitOfMeasure,
      isWeighted: item.isWeighted,
      qtyInPackage: item.qtyInPackage,
      unitOfMeasurePrice: item.unitOfMeasurePrice,
      quantity: item.quantity,
      category: item.category,
    },
    create: {
      itemCode,
      itemName: item.itemName,
      manufacturerName: item.manufacturerName,
      unitQty: item.unitQty,
      unitOfMeasure: item.unitOfMeasure,
      isWeighted: item.isWeighted,
      qtyInPackage: item.qtyInPackage,
      unitOfMeasurePrice: item.unitOfMeasurePrice,
      quantity: item.quantity,
      category: item.category,
    },
  });

  const store = await findStoreByIds({
    ChainId,
    SubChainId,
    StoreId,
  });

  if (!store) {
    console.log(
      `Store not found for ChainId: ${ChainId}, SubChainId: ${SubChainId}, StoreId: ${StoreId}`
    );
    return;
  }


  const previous = await prisma.store_grocery.findUnique({
    where: {
      itemCode_ChainId_SubChainId_StoreId: {
        itemCode,
        ChainId,
        SubChainId,
        StoreId,
      },
    },
  });

  const storeGrocery = await prisma.store_grocery.upsert({
    where: {
      itemCode_ChainId_SubChainId_StoreId: {
        itemCode,
        ChainId,
        SubChainId,
        StoreId,
      },
    },
    update: {
      itemPrice,
    },
    create: {
      itemCode,
      ChainId,
      SubChainId,
      StoreId,
      itemPrice,
    },
  });


  const priceChanged =
    !previous || // חדש לגמרי
    previous.itemPrice === null ||
    priceUpdate.itemPrice === undefined ||
    Number(previous.itemPrice) !== Number(priceUpdate.itemPrice);

  if (priceChanged && priceUpdate.date) {
    // Check if this exact timestamp already exists to prevent duplicates
    const existingPriceHistory = await prisma.store_grocery_price_history.findUnique({
      where: {
        itemCode_ChainId_SubChainId_StoreId_updateDatetime: {
          itemCode,
          ChainId,
          SubChainId,
          StoreId,
          updateDatetime: priceUpdate.date,
        },
      },
    });

    // Only create if this timestamp doesn't exist (preserves price history integrity)
    if (!existingPriceHistory) {
      await prisma.store_grocery_price_history.create({
        data: {
          itemCode,
          ChainId,
          SubChainId,
          StoreId,
          price: itemPrice,
          updateDatetime: priceUpdate.date,
        },
      });
    }
  }
}

export async function findGrocery(itemCode: string) {
  return await prisma.grocery.findFirst({
    where: { itemCode },
  });
}

export async function findGroceriesBulk(itemCodes: string[]) {
  // Handle empty array
  if (itemCodes.length === 0) return [];
  
  // Prisma bulk query - much faster than individual queries
  return await prisma.grocery.findMany({
    where: {
      itemCode: {
        in: itemCodes // Single query for all items instead of individual queries
      }
    },
    select: {
      itemCode: true,
      category: true,
      itemName: true,
      manufacturerName: true,
      unitQty: true
    }
  });
}
