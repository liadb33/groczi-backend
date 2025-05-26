import { normalizeKeys } from "../../utils/general.utils.js";
import {
  Grocery,
  GroceryPriceUpdate,
  GroceryReference,
} from "./grocery.entity.js";

export function mapToGroceryAndReference(
  input: Record<string, any>
): GroceryReference {
  const data = normalizeKeys(input);

  const name = data["itemname"] ? String(data["itemname"]).trim() : undefined;
  const name2 = data["manufactureritemdescription"]
    ? String(data["manufactureritemdescription"]).trim()
    : undefined;
  if (name == null) {
    data["itemname"] = name2;
  } else {
    data["itemname"] = name;
  }
  const grocery: Grocery = {
    itemCode: String(data["itemcode"] ?? "").trim(),
    itemType: data["itemtype"] ? Number(data["itemtype"]) : undefined,
    itemName: data["itemname"] ? String(data["itemname"]).trim() : undefined,
    manufacturerName: data["manufacturername"]
      ? String(data["manufacturername"]).trim()
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
  };

  const priceUpdate: GroceryPriceUpdate = {
    ChainId: data["chainid"] ?? String(data["chainId"]).trim(),
    SubChainId: data["subchainid"] ?? String(data["subChainId"]).trim(),
    StoreId: data["storeid"] ?? String(data["storeId"]).trim(),
    itemCode: grocery.itemCode,
    itemPrice: data["itemprice"] ?? Number(data["itemprice"]),
    date: data["priceupdatedate"]
      ? new Date(String(data["priceupdatedate"]).replace(" ", "T"))
      : undefined
  };

  const reference: GroceryReference = {
    itemCode: grocery.itemCode,
    ChainId: priceUpdate.ChainId,
    SubChainId: priceUpdate.SubChainId,
    StoreId: priceUpdate.StoreId,
    itemPrice: priceUpdate.itemPrice,
    allowDiscount: data["allowdiscount"] === "1" || data["allowdiscount"] === 1,
    item: grocery,
    priceUpdate: priceUpdate,
  };

  return reference;
}
