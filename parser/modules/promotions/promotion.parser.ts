import { Promotion } from "./promotion.entity.js";
import { createParser, parseXmlFile } from "../../utils/xml-parser.utils.js";
import { findStoreByChainIdAndStoreId } from "../stores/stores.repository.js";
import { mapPromotion } from "./promotion.mapper.js";
import { getIdsFromRoot, logUnrecognizedFormat, processItems } from "../../utils/general.utils.js";

const parser = createParser("promotions");

export async function parsePromotionXmlFile(filePath: string): Promise<Promotion[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) {
    console.log("Error in promotions : parsing file:", filePath);
    return [];
  }

  const root = json.Root ??
               json.root ??
               json.OrderXml?.Envelope ?? 
               json.Promos ??
               json.promos ??
              {};

  // Get chain, store, and sub-chain IDs from the root and filename
  const { chainId, storeId, subChainId: xmlSubChainId } = getIdsFromRoot(root, filePath);
  if (!chainId || !storeId) return [];

  // Determine subChainId, either from XML or by fetching from the store repository
  let subChainId = xmlSubChainId ?? (await getSubChainId(chainId, storeId));
  if (!subChainId) return [];

  const orderLines = json.OrderXml?.Envelope?.Header?.Details?.Line;
  if (orderLines) return processItems(orderLines, chainId, subChainId, storeId, mapPromotion);
  
  const grouped = root.Promotions?.Promotion || json.Promotions?.Promotion;
  if (grouped) return processItems(grouped, chainId, subChainId, storeId, mapPromotion);
  
  const sales = root.Promos?.Sale || json.Promos?.Sales?.Sale || json.Promos?.Sale;
  if (sales) return processItems(sales, chainId, subChainId, storeId, mapPromotion);
  
  
  return logUnrecognizedFormat(filePath,"promotions.parser.ts");
}

// Helper function to get subChainId by querying the store repository
async function getSubChainId(chainId: number, storeId: number): Promise<number | null> {
  const storeRecord = await findStoreByChainIdAndStoreId(chainId, storeId);
  return storeRecord ? storeRecord.SubChainId : null;
}
