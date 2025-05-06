import { XMLParser } from "fast-xml-parser";
import { GroceryReference } from "./grocery.entity.js";
import { parseXmlFile } from "../../utils/xml-parser.utils.js";
import { mapToGroceryAndReference } from "./groceries.mapper.js";
import { logUnrecognizedFormat, processItems } from "../../utils/general.utils.js";
import { log } from "console";

const parser = new XMLParser({ ignoreAttributes: false});

export async function parseGroceryXmlFile(filePath: string): Promise<GroceryReference[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) {
    console.log("Error in groceries : parsing file:", filePath);
    return [];
  }

  const dataRoot: any = json.root ?? json.Root;
  if (!dataRoot) return [];

  const chainId = Number(dataRoot.ChainId ?? dataRoot.ChainID ?? null);
  const subChainId = Number(dataRoot.SubChainId ?? dataRoot.SubChainID ?? null);
  const storeId = Number(dataRoot.StoreId ?? null);

  const items = processItems(dataRoot.Items?.Item, chainId, subChainId, storeId, mapToGroceryAndReference);
  if(!items) 
    return logUnrecognizedFormat(filePath,"groceries.parser.ts");;
  
  return items;
}
