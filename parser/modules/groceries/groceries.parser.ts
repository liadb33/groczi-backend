import { XMLParser } from "fast-xml-parser";
import { GroceryReference } from "./grocery.entity.js";
import { parseXmlFile } from "../../utils/xml-parser.utils.js";
import { mapToGroceryAndReference } from "./groceries.mapper.js";
import {
  logUnrecognizedFormat,
  processItems,
} from "../../utils/general.utils.js";

const parser = new XMLParser({ ignoreAttributes: false });

export async function parseGroceryXmlFile(
  filePath: string
): Promise<GroceryReference[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) {
    console.log("Error in groceries : parsing file:", filePath);
    return [];
  }

  const dataRoot: any = json.root ?? json.Root;
  if (!dataRoot) return [];

  const chainId = String(dataRoot.ChainId ?? dataRoot.ChainID ?? "").trim();
  const subChainId = String(
    dataRoot.SubChainId ?? dataRoot.SubChainID ?? ""
  ).trim();
  const storeId = String(dataRoot.StoreId ?? "").trim();

  const items = processItems(
    dataRoot.Items?.Item,
    chainId,
    subChainId,
    storeId,
    mapToGroceryAndReference
  );
  if (!items) return logUnrecognizedFormat(filePath, "groceries.parser.ts");

  return items;
}
