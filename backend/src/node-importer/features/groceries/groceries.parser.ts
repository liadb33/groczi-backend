import { XMLParser } from "fast-xml-parser";
import { Grocery, GroceryReference } from "./grocery.entity.js";
import { readFileWithEncoding } from "../utils/encoding.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (jpath: string) => {
    return jpath === "root.Items.Item";
  },
});

export async function parseGroceryXmlFile(
  filePath: string
): Promise<GroceryReference[]> {
  const xmlContent = await readFileWithEncoding(filePath);
  const cleanXml =
    xmlContent.charCodeAt(0) === 0xfeff ? xmlContent.slice(1) : xmlContent;
  const json = parser.parse(cleanXml);
  if (!json?.root) return [];

  const root = json.root;
  const storeId = Number(root.StoreId);

  const rawItems = Array.isArray(root.Items.Item)
    ? root.Items.Item
    : [root.Items.Item];

  const groceries: Grocery[] = rawItems.map((it: any) => ({
    itemCode: it.ItemCode,
    itemType: Number(it.ItemType),
    itemName: it.ItemName,
    manufacturerName: it.ManufacturerName,
    manufactureCountry: it.ManufactureCountry || "",
    manufacturerItemDescription: it.ManufacturerItemDescription,
    unitQty: it.UnitQty,
    unitOfMeasure: it.UnitOfMeasure,
    isWeighted: it.bIsWeighted === "1" || it.bIsWeighted === 1,
    qtyInPackage: Number(it.QtyInPackage),
    unitOfMeasurePrice: Number(it.UnitOfMeasurePrice),
    quantity: Number(it.Quantity),
  }));

  return rawItems.map((it: any) => {
    const itemCode = it.ItemCode;
    const itemPrice = Number(it.ItemPrice);
    const allowDiscount = it.AllowDiscount === "1" || it.AllowDiscount === 1;

    const ref: GroceryReference = {
      itemCode,
      storeId,
      itemPrice,
      allowDiscount,
      items: groceries,
    };
    return ref;
  });
}
