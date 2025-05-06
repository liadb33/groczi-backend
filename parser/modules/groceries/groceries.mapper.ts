import { Grocery, GroceryReference } from "./grocery.entity";

export function mapToGroceryAndReference(
  raw: Record<string, any>,
  chainId: number,
  subChainId: number,
  storeId: number
): GroceryReference {
  const grocery: Grocery = {
    itemCode: Number(raw.ItemCode || 0),
    itemType: Number(raw.ItemType || 0),
    itemName: String(raw.ItemName || "").trim(),
    manufacturerName: String(raw.ManufacturerName || "").trim(),
    manufactureCountry: String(raw.ManufactureCountry || "").trim(),
    manufacturerItemDescription: String( raw.ManufacturerItemDescription || "").trim(),
    unitQty: String(raw.UnitQty || "").trim(),
    unitOfMeasure: String(raw.UnitOfMeasure || "").trim(),
    isWeighted: raw.bIsWeighted === "1" || raw.bIsWeighted === 1,
    qtyInPackage: Number(raw.QtyInPackage || 0),
    unitOfMeasurePrice: Number(raw.UnitOfMeasurePrice || 0),
    quantity: Number(raw.Quantity || 0),
  };

  const reference: GroceryReference = {
    itemCode: grocery.itemCode,
    ChainId: BigInt(chainId),
    SubChainId: subChainId,
    StoreId: storeId,
    itemPrice: Number(raw.ItemPrice || 0),
    allowDiscount: raw.AllowDiscount === "1" || raw.AllowDiscount === 1,
    item: grocery,
  };

  return reference;
}
