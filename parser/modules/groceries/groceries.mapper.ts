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
    priceupdatedate,
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

  const priceUpdate: GroceryPriceUpdate = {
    ChainId: resolvedChainId,
    SubChainId: resolvedSubChainId,
    StoreId: resolvedStoreId,
    itemCode: grocery.itemCode,
    itemPrice: itemprice ?? Number(itemprice),
    date: priceupdatedate
      ? new Date(String(priceupdatedate).replace(" ", "T"))
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
