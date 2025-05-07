import { Grocery, GroceryReference } from "./grocery.entity.js";

export function mapToGroceryAndReference(
  raw: Record<string, any>,
  chainId: string,
  subChainId: string,
  storeId: string
): GroceryReference {
  const grocery: Grocery = {
    itemCode: String(raw.ItemCode || "").trim(),
    itemType: raw.ItemType ? Number(raw.ItemType) : undefined,
    itemName: raw.ItemName ? String(raw.ItemName).trim() : undefined,
    manufacturerName: raw.ManufacturerName
      ? String(raw.ManufacturerName).trim()
      : undefined,
    manufactureCountry: raw.ManufactureCountry
      ? String(raw.ManufactureCountry).trim()
      : undefined,
    manufacturerItemDescription: raw.ManufacturerItemDescription
      ? String(raw.ManufacturerItemDescription).trim()
      : undefined,
    unitQty: raw.UnitQty ? String(raw.UnitQty).trim() : undefined,
    unitOfMeasure: raw.UnitOfMeasure
      ? String(raw.UnitOfMeasure).trim()
      : undefined,
    isWeighted: raw.bIsWeighted === "1" || raw.bIsWeighted === 1,
    qtyInPackage: raw.QtyInPackage ? Number(raw.QtyInPackage) : undefined,
    unitOfMeasurePrice: raw.UnitOfMeasurePrice
      ? Number(raw.UnitOfMeasurePrice)
      : undefined,
    quantity: raw.Quantity ? Number(raw.Quantity) : undefined,
  };

  const reference: GroceryReference = {
    itemCode: grocery.itemCode,
    ChainId: chainId,
    SubChainId: subChainId,
    StoreId: storeId,
    itemPrice: raw.ItemPrice ? Number(raw.ItemPrice) : undefined,
    allowDiscount: raw.AllowDiscount === "1" || raw.AllowDiscount === 1,
    item: grocery,
  };

  return reference;
}
