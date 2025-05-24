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
    allowDiscount,
    item,
  } = ref;

  // 1. Upsert the Grocery master record (unchanged)
  await prisma.grocery.upsert({
    where: { itemCode },
    update: {
      itemType: item.itemType,
      itemName: item.itemName,
      manufacturerName: item.manufacturerName,
      unitQty: item.unitQty,
      unitOfMeasure: item.unitOfMeasure,
      isWeighted: item.isWeighted,
      qtyInPackage: item.qtyInPackage,
      unitOfMeasurePrice: item.unitOfMeasurePrice,
      quantity: item.quantity,
    },
    create: {
      itemCode,
      itemType: item.itemType,
      itemName: item.itemName,
      manufacturerName: item.manufacturerName,
      unitQty: item.unitQty,
      unitOfMeasure: item.unitOfMeasure,
      isWeighted: item.isWeighted,
      qtyInPackage: item.qtyInPackage,
      unitOfMeasurePrice: item.unitOfMeasurePrice,
      quantity: item.quantity,
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
  // 2. Upsert ל־store_grocery עם ה־Composite PK החדש
  await prisma.store_grocery.upsert({
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
      allowDiscount,
    },
    create: {
      itemCode,
      ChainId,
      SubChainId,
      StoreId,
      itemPrice,
      allowDiscount,
    },
  });
}
