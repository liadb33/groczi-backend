import { categorizeProduct } from "../../utils/categories.utils.js";
import { normalizeKeys } from "../../utils/general.utils.js";
import { Grocery, GroceryReference } from "./grocery.entity.js";

export function mapToGroceryAndReference(
  input: Record<string, any>
): GroceryReference {
  const data = normalizeKeys(input);

  const grocery: Grocery = {
    itemCode: String(data["itemcode"] ?? "").trim(),
    itemType: data["itemtype"] ? Number(data["itemtype"]) : undefined,
    itemName: data["itemname"] ? String(data["itemname"]).trim() : undefined,
    manufacturerName: data["manufacturername"]
      ? String(data["manufacturername"]).trim()
      : undefined,
    manufactureCountry: data["manufacturecountry"]
      ? String(data["manufacturecountry"]).trim()
      : undefined,
    manufacturerItemDescription: data["manufactureritemdescription"]
      ? String(data["manufactureritemdescription"]).trim()
      : undefined,
    unitQty: data["unitqty"] ? String(data["unitqty"]).trim() : undefined,
    unitOfMeasure: data["unitofmeasure"]
      ? String(data["unitofmeasure"]).trim()
      : undefined,
    isWeighted: data["bisweighted"] === "1" || data["bisweighted"] === 1,
    qtyInPackage: data["qtyinpackage"]
      ? Number(data["qtyinpackage"])
      : undefined,
    unitOfMeasurePrice: data["unitofmeasureprice"]
      ? Number(data["unitofmeasureprice"])
      : undefined,
    quantity: data["quantity"] ? Number(data["quantity"]) : undefined,
    category: categorizeProduct(data["itemname"]) ?? undefined,
  };

  const reference: GroceryReference = {
    itemCode: grocery.itemCode,
    ChainId: data["chainid"] ?? String(data["chainId"]).trim(),
    SubChainId: data["subchainid"] ?? String(data["subChainId"]).trim(),
    StoreId: data["storeid"] ?? String(data["storeId"]).trim(),
    itemPrice: data["itemprice"] ? Number(data["itemprice"]) : undefined,
    allowDiscount: data["allowdiscount"] === "1" || data["allowdiscount"] === 1,
    item: grocery,
  };

  return reference;
}
