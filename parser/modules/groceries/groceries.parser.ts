import { XMLParser } from "fast-xml-parser";
import { Grocery, GroceryReference } from "./grocery.entity.js";
import { parseXmlFile, readFileWithEncoding } from "../../utils/xml-parser.utils.js";
import { mapToGroceryAndReference } from "./groceries.mapper.js";


const parser = new XMLParser({ ignoreAttributes: false,});

export async function parseGroceryXmlFile(filePath: string): Promise<GroceryReference[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) return [];

  const dataRoot: any = json.root ?? json.Root;
  if (!dataRoot) return [];

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
