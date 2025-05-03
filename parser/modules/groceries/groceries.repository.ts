import prisma from "../../database/prismaClient.js";
import { GroceryReference } from "./grocery.entity.js";

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
  if (!itemCode || !StoreId) return;

  // 1. Upsert the Grocery master record (unchanged)
  await prisma.grocery.upsert({
    where: { itemCode },
    update: {
      itemType: item.itemType,
      itemName: item.itemName,
      manufacturerName: item.manufacturerName,
      manufactureCountry: item.manufactureCountry,
      manufacturerItemDescription: item.manufacturerItemDescription,
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
      manufactureCountry: item.manufactureCountry,
      manufacturerItemDescription: item.manufacturerItemDescription,
      unitQty: item.unitQty,
      unitOfMeasure: item.unitOfMeasure,
      isWeighted: item.isWeighted,
      qtyInPackage: item.qtyInPackage,
      unitOfMeasurePrice: item.unitOfMeasurePrice,
      quantity: item.quantity,
    },
  });

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
