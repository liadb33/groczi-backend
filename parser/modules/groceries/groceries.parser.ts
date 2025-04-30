import { XMLParser } from "fast-xml-parser";
import { Grocery, GroceryReference } from "./grocery.entity.js";
import { readFileWithEncoding } from "../../utils/encoding.js";

export function mapToGroceryAndReference(
  item: Record<string, any>,
  StoreId: number
): GroceryReference {
  const grocery: Grocery = {
    itemCode: Number(item.ItemCode || 0),
    itemType: Number(item.ItemType || 0),
    itemName: String(item.ItemName || ""),
    manufacturerName: String(item.ManufacturerName || ""),
    manufactureCountry: String(item.ManufactureCountry ?? ""),
    manufacturerItemDescription: String(item.ManufacturerItemDescription || ""),
    unitQty: String(item.UnitQty || ""),
    unitOfMeasure: String(item.UnitOfMeasure || ""),
    isWeighted: item.bIsWeighted === "1" || item.bIsWeighted === 1,
    qtyInPackage: Number(item.QtyInPackage || 0),
    unitOfMeasurePrice: Number(item.UnitOfMeasurePrice || 0),
    quantity: Number(item.Quantity || 0),
  };

  const ref: GroceryReference = {
    itemCode: Number(item.ItemCode || 0),
    StoreId,
    itemPrice: Number(item.ItemPrice || 0),
    allowDiscount: item.AllowDiscount === "1" || item.AllowDiscount === 1,
    item: grocery,
  };

  return ref;
}

const parser = new XMLParser({
  ignoreAttributes: false,
});

export async function parseGroceryXmlFile(
  filePath: string
): Promise<GroceryReference[]> {
  const xmlContent = await readFileWithEncoding(filePath);
  const cleanXml =
    xmlContent.charCodeAt(0) === 0xfeff ? xmlContent.slice(1) : xmlContent;

  const json = parser.parse(cleanXml);
  if (!json) return [];

  const dataRoot: any = json.root ?? json.Root;
  if (!dataRoot) return [];

  const itemsContainer = dataRoot.Items;
  if (!itemsContainer || !itemsContainer.Item) return [];

  const rawItems = Array.isArray(itemsContainer.Item)
    ? itemsContainer.Item
    : [itemsContainer.Item];

  const storeId = Number(dataRoot.StoreId) || 0;

  return rawItems.map((item: any) => mapToGroceryAndReference(item, storeId));
}
