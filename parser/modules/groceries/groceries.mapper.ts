import { normalizeKeys } from "../../utils/general.utils.js";
import { fixProductData } from "../../utils/openai.utils.js";
import { findGrocery } from "../../repositories/groceries.repository.js";
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

  //check if product is already in the database if it is, check if category exists we dont need to use open ai
  const existingGrocery = await findGrocery(String(itemcode ?? "").trim());
  
  let fixedProduct = null;
  
  // Only call OpenAI if the product doesn't exist in the database
  if (!existingGrocery?.category) {
    const productDataForAI = {
      itemName: itemName || "",
      unitQty: unitqty ? String(unitqty).trim() : null,
      manufactureName: manufacturername ? String(manufacturername).trim() : null,
    };
    
    fixedProduct = await fixProductData(productDataForAI);
    console.log(`🤖 AI enhanced product: ${itemName} -> ${fixedProduct?.itemName}`);
  } else {
    console.log(`✅ Product exists in DB: ${existingGrocery.itemName}`);
  }

  const grocery: Grocery = {
    itemCode: String(itemcode ?? "").trim(),
    itemName: fixedProduct?.itemName || existingGrocery?.itemName || itemName,
    manufacturerName: fixedProduct?.manufactureName || existingGrocery?.manufacturerName || (manufacturername ? String(manufacturername).trim() : undefined),
    unitQty: fixedProduct?.unitQty || existingGrocery?.unitQty || (unitqty ? String(unitqty).trim() : undefined),
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

  const finalItemPrice = itemprice ?? Number(itemprice);
  
  // Skip items with price of 0
  if (finalItemPrice === 0) {
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
