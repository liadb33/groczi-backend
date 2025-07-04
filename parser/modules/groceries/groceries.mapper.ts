import { normalizeKeys } from "../../utils/text-normalization.utils.js";
import { findGrocery } from "../../repositories/groceries.repository.js";
import {
  Grocery,
  GroceryPriceUpdate,
  GroceryReference,
} from "./grocery.entity.js";
import { parseDateTime } from "../../utils/date.utils.js";

// Extract common data from input for AI processing
export function extractItemDataForAI(input: Record<string, any>): {
  itemCode: string;
  itemName: string;
  manufactureName: string | null;
  unitQty: string | null;
  rawData: Record<string, any>;
} {
  const data = normalizeKeys(input);

  const {
    itemname,
    manufactureritemdescription,
    itemcode,
    manufacturername,
    unitqty,
  } = data;

  const name = itemname ? String(itemname).trim() : undefined;
  const name2 = manufactureritemdescription
    ? String(manufactureritemdescription).trim()
    : undefined;

  const itemName = name ?? name2 ?? "";

  return {
    itemCode: String(itemcode ?? "").trim(),
    itemName,
    manufactureName: manufacturername ? String(manufacturername).trim() : null,
    unitQty: unitqty ? String(unitqty).trim() : null,
    rawData: data
  };
}

// Create GroceryReference with AI-enhanced data
export async function mapToGroceryWithAIData(
  input: Record<string, any>,
  aiData: {
    itemCode: string;
    itemName: string;
    manufactureName: string | null;
    unitQty: string | null;
    category: string | null;
  }
): Promise<GroceryReference | null> {
  const data = normalizeKeys(input);

  const {
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
  } = data;

  const grocery: Grocery = {
    itemCode: aiData.itemCode,
    itemName: aiData.itemName,
    manufacturerName: aiData.manufactureName || undefined,
    unitQty: aiData.unitQty || undefined,
    unitOfMeasure: unitofmeasure ? String(unitofmeasure).trim() : undefined,
    isWeighted: bisweighted === "1" || bisweighted === 1,
    qtyInPackage: qtyinpackage ? Number(qtyinpackage) : undefined,
    unitOfMeasurePrice: unitofmeasureprice ? Number(unitofmeasureprice) : undefined,
    quantity: quantity ? Number(quantity) : undefined,
    category: aiData.category || undefined,
  };

  const resolvedChainId = chainid ?? (chainId ? String(chainId).trim() : undefined);
  const resolvedSubChainId = subchainid ?? (subChainId ? String(subChainId).trim() : undefined);
  const resolvedStoreId = storeid ?? (storeId ? String(storeId).trim() : undefined);

  // Extract date from any supported field and parse it properly
  const dateValue = data["priceupdatedate"] ?? data["priceupdatetime"] ?? undefined;

  const finalItemPrice = itemprice ?? Number(itemprice);
  
  // Skip items with price of 0
  if (finalItemPrice === 0 || finalItemPrice === null) {
    return null;
  }

  const priceUpdate: GroceryPriceUpdate = {
    ChainId: resolvedChainId,
    SubChainId: resolvedSubChainId,
    StoreId: resolvedStoreId,
    itemCode: grocery.itemCode,
    itemPrice: finalItemPrice,
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

export async function mapToGroceryAndReference(
  input: Record<string, any>
): Promise<GroceryReference | null> {
  const data = normalizeKeys(input);

  let {
    itemname,
    manufactureritemdescription,
    itemcode,
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
  } = data;

  const name = itemname ? String(itemname).trim() : undefined;
  const name2 = manufactureritemdescription
    ? String(manufactureritemdescription).trim()
    : undefined;

  const itemName = name ?? name2;

  // Check if product is already in the database
  const existingGrocery = await findGrocery(String(itemcode ?? "").trim());
  
  const grocery: Grocery = {
    itemCode: String(itemcode ?? "").trim(),
    itemName: existingGrocery?.itemName || itemName,
    manufacturerName: existingGrocery?.manufacturerName || (manufacturername ? String(manufacturername).trim() : undefined),
    unitQty: existingGrocery?.unitQty || (unitqty ? String(unitqty).trim() : undefined),
    unitOfMeasure: unitofmeasure ? String(unitofmeasure).trim() : undefined,
    isWeighted: bisweighted === "1" || bisweighted === 1,
    qtyInPackage: qtyinpackage ? Number(qtyinpackage) : undefined,
    unitOfMeasurePrice: unitofmeasureprice ? Number(unitofmeasureprice) : undefined,
    quantity: quantity ? Number(quantity) : undefined,
    category: existingGrocery?.category || undefined,
  };

  const resolvedChainId = chainid ?? (chainId ? String(chainId).trim() : undefined);
  const resolvedSubChainId = subchainid ?? (subChainId ? String(subChainId).trim() : undefined);
  const resolvedStoreId = storeid ?? (storeId ? String(storeId).trim() : undefined);

  // Extract date from any supported field and parse it properly
  const dateValue = data["priceupdatedate"] ?? data["priceupdatetime"] ?? undefined;

  const finalItemPrice = itemprice ?? Number(itemprice);
  
  // Skip items with price of 0
  if (finalItemPrice === 0 || finalItemPrice === null || finalItemPrice === undefined) {
    return null;
  }

  const priceUpdate: GroceryPriceUpdate = {
    ChainId: resolvedChainId,
    SubChainId: resolvedSubChainId,
    StoreId: resolvedStoreId,
    itemCode: grocery.itemCode,
    itemPrice: finalItemPrice,
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
