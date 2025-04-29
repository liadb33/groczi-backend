import { XMLParser } from "fast-xml-parser";
import { Grocery, GroceryReference } from "./grocery.entity.js";
import { readFileWithEncoding } from "../utils/encoding.js";

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
  const refs: GroceryReference[] = [];

  for (const it of rawItems) {
    const grocery: Grocery = {
      itemCode: String(it.ItemCode) || "",
      itemType: Number(it.ItemType) || 0,
      itemName: String(it.ItemName) || "",
      manufacturerName: it.ManufacturerName || "",
      manufactureCountry: String(it.ManufactureCountry) ?? "",
      manufacturerItemDescription: String(it.ManufacturerItemDescription) || "",
      unitQty: String(it.UnitQty) || "",
      unitOfMeasure: String(it.UnitOfMeasure) || "",
      isWeighted: it.bIsWeighted === "1" || it.bIsWeighted === 1,
      qtyInPackage: Number(it.QtyInPackage) || 0,
      unitOfMeasurePrice: Number(it.UnitOfMeasurePrice) || 0,
      quantity: Number(it.Quantity) || 0,
    };

    const ref: GroceryReference = {
      itemCode: String(it.ItemCode) || "",
      storeId,
      itemPrice: Number(it.ItemPrice) || 0,
      allowDiscount: it.AllowDiscount === "1" || it.AllowDiscount === 1,
      item: grocery,
    };

    refs.push(ref);
  }
  return refs;
}
