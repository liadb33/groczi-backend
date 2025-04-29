import prisma from "../prismaClient.js";
import { GroceryReference } from "../../features/groceries/grocery.entity.js";

export async function saveGrocery(ref: GroceryReference) {
  if (!ref.itemCode || !ref.storeId) return;
  // 1. Upsert the Grocery master record
  await prisma.grocery.upsert({
    where: { itemCode: ref.itemCode },
    update: {
      itemType: ref.item.itemType,
      itemName: ref.item.itemName,
      manufacturerName: ref.item.manufacturerName,
      manufactureCountry: ref.item.manufactureCountry,
      manufacturerItemDescription: ref.item.manufacturerItemDescription,
      unitQty: ref.item.unitQty,
      unitOfMeasure: ref.item.unitOfMeasure,
      isWeighted: ref.item.isWeighted,
      qtyInPackage: ref.item.qtyInPackage,
      unitOfMeasurePrice: ref.item.unitOfMeasurePrice,
      quantity: ref.item.quantity,
    },
    create: {
      itemCode: ref.itemCode,
      itemType: ref.item.itemType,
      itemName: ref.item.itemName,
      manufacturerName: ref.item.manufacturerName,
      manufactureCountry: ref.item.manufactureCountry,
      manufacturerItemDescription: ref.item.manufacturerItemDescription,
      unitQty: ref.item.unitQty,
      unitOfMeasure: ref.item.unitOfMeasure,
      isWeighted: ref.item.isWeighted,
      qtyInPackage: ref.item.qtyInPackage,
      unitOfMeasurePrice: ref.item.unitOfMeasurePrice,
      quantity: ref.item.quantity,
    },
  });

  // 2. Upsert the GroceryReferences join record
  await prisma.groceryReferences.upsert({
    where: {
      // composite PK
      itemCode_storeId: {
        itemCode: ref.itemCode,
        storeId: ref.storeId,
      },
    },
    update: {
      itemPrice: ref.itemPrice,
      allowDiscount: ref.allowDiscount,
    },
    create: {
      itemCode: ref.itemCode,
      storeId: ref.storeId,
      itemPrice: ref.itemPrice,
      allowDiscount: ref.allowDiscount,
    },
  });
}
