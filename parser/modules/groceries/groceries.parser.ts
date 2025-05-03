import { XMLParser } from "fast-xml-parser";
import { Grocery, GroceryReference } from "./grocery.entity.js";
import { readFileWithEncoding } from "../../utils/encoding.utils.js";

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
    manufacturerItemDescription: String(
      raw.ManufacturerItemDescription || ""
    ).trim(),
    unitQty: String(raw.UnitQty || "").trim(),
    unitOfMeasure: String(raw.UnitOfMeasure || "").trim(),
    isWeighted: raw.bIsWeighted === "1" || raw.bIsWeighted === 1,
    qtyInPackage: Number(raw.QtyInPackage || 0),
    unitOfMeasurePrice: Number(raw.UnitOfMeasurePrice || 0),
    quantity: Number(raw.Quantity || 0),
  };

  const reference: GroceryReference = {
    itemCode: grocery.itemCode,
    ChainId: chainId,
    SubChainId: subChainId,
    StoreId: storeId,
    itemPrice: Number(raw.ItemPrice || 0),
    allowDiscount: raw.AllowDiscount === "1" || raw.AllowDiscount === 1,
    item: grocery,
  };

  return reference;
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

  // השליפת ChainId ו-SubChainId
  const chainId = Number(dataRoot.ChainId ?? (dataRoot.ChainID || 0));
  const subChainId = Number(dataRoot.SubChainId ?? (dataRoot.SubChainID || 0));
  const storeId = Number(dataRoot.StoreId ?? 0);

  const items = dataRoot.Items?.Item
    ? Array.isArray(dataRoot.Items.Item)
      ? dataRoot.Items.Item
      : [dataRoot.Items.Item]
    : [];

  return items.map((item: any) =>
    mapToGroceryAndReference(item, chainId, subChainId, storeId)
  );
}
