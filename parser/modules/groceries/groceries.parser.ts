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

  const xmlChainRaw = dataRoot.ChainId ?? dataRoot.ChainID ?? "";
  const xmlSubRaw = dataRoot.SubChainId ?? dataRoot.SubChainID ?? "";
  const xmlStoreRaw = dataRoot.StoreId ?? dataRoot.StoreID ?? "";


  const { chainId, storeId, subChainId } = await getIdsFromRoot(
    xmlChainRaw,xmlSubRaw,xmlStoreRaw,
    filePath
  );

  if (subChainId === null) return [];

  const arr = ensureArray(dataRoot.Items?.Item);

  const itemsWithNulls = await Promise.all(
    arr.map((item) =>
      mapToGroceryAndReference({ ...item, chainId, subChainId, storeId })
    )
  );

  // Filter out null values (items with price 0)
  const items = itemsWithNulls.filter((item): item is GroceryReference => item !== null);

  if (!items) return logUnrecognizedFormat(filePath, "groceries.parser.ts");

  return items;
}
