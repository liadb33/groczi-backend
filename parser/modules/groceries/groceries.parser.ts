import { XMLParser } from "fast-xml-parser";
import { GroceryReference } from "./grocery.entity.js";
import { parseXmlFile } from "../../utils/xml-parser.utils.js";
import { mapToGroceryAndReference } from "./groceries.mapper.js";
import {
  ensureArray,
  getIdsFromRoot,
  logUnrecognizedFormat,
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

  const { chainId, storeId, subChainId } = await getIdsFromRoot(
    dataRoot,
    filePath
  );

  if (subChainId === null) return [];

  const arr = ensureArray(dataRoot.Items?.Item);

  const items = arr.map((item) =>
    mapToGroceryAndReference({ ...item, chainId, subChainId, storeId })
  );

  if (!items) return logUnrecognizedFormat(filePath, "groceries.parser.ts");

  return items;
}
