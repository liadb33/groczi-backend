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
