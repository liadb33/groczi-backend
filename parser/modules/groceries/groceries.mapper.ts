import { normalizeKeys } from "../../utils/general.utils.js";
import {
  Grocery,
  GroceryPriceUpdate,
  GroceryReference,
} from "./grocery.entity.js";

// Helper function to find date value from multiple possible field names
function extractDateValue(data: Record<string, any>): string | undefined {
  const possibleDateFields = [
    'priceupdatedate',     // PriceUpdateDate
    'priceupdatetime',     // PriceUpdateTime
  ];

  for (const field of possibleDateFields) {
    if (data[field]) {
      return data[field];
    }
  }
  
  return undefined;
}

// Helper function to parse date string in multiple formats
function parseDateTime(dateString: string): Date {
  // Handle space-separated format: "2024-01-15 10:30:00"
  if (dateString.includes(' ') && !dateString.includes('T')) {
    return new Date(dateString.replace(" ", "T"));
  }
  
  // Handle ISO format: "2025-01-14T16:17:19.000"
  return new Date(dateString);
}

export function mapToGroceryAndReference(
  input: Record<string, any>
): GroceryReference {
  const data = normalizeKeys(input);

  let {
    itemname,
    manufactureritemdescription,
    itemcode,
    itemtype,
    manufacturername,
    unitqty,
    unitofmeasure,
    bisweighted,
    qtyinpackage,
    unitofmeasureprice,
    quantity,
    chainid,
    chainId,
    subchainid,
    subChainId,
    storeid,
    storeId,
    itemprice,
    allowdiscount,
  } = data;

  const name = itemname ? String(itemname).trim() : undefined;
  const name2 = manufactureritemdescription
    ? String(manufactureritemdescription).trim()
    : undefined;

  const itemName = name ?? name2;

  const grocery: Grocery = {
    itemCode: String(itemcode ?? "").trim(),
    itemName: itemName,
    manufacturerName: manufacturername ? String(manufacturername).trim() : undefined,
    unitQty: unitqty ? String(unitqty).trim() : undefined,
    unitOfMeasure: unitofmeasure ? String(unitofmeasure).trim() : undefined,
    isWeighted: bisweighted === "1" || bisweighted === 1,
    qtyInPackage: qtyinpackage ? Number(qtyinpackage) : undefined,
    unitOfMeasurePrice: unitofmeasureprice ? Number(unitofmeasureprice) : undefined,
    quantity: quantity ? Number(quantity) : undefined,
  };

  const resolvedChainId = chainid ?? (chainId ? String(chainId).trim() : undefined);
  const resolvedSubChainId = subchainid ?? (subChainId ? String(subChainId).trim() : undefined);
  const resolvedStoreId = storeid ?? (storeId ? String(storeId).trim() : undefined);

  // Extract date from any supported field and parse it properly
  const dateValue = extractDateValue(data);

  const priceUpdate: GroceryPriceUpdate = {
    ChainId: resolvedChainId,
    SubChainId: resolvedSubChainId,
    StoreId: resolvedStoreId,
    itemCode: grocery.itemCode,
    itemPrice: itemprice ?? Number(itemprice),
    date: dateValue
      ? parseDateTime(String(dateValue))
      : undefined,
  };

  const reference: GroceryReference = {
    itemCode: grocery.itemCode,
    ChainId: resolvedChainId,
    SubChainId: resolvedSubChainId,
    StoreId: resolvedStoreId,
    itemPrice: priceUpdate.itemPrice,
    item: grocery,
    priceUpdate: priceUpdate,
  };

  return reference;
}
