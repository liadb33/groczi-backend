import { Promotion } from "./promotion.entity.js";
import { createParser, parseXmlFile } from "../../utils/xml-parser.utils.js";
import { findStoreByChainIdAndStoreId } from "../../repositories/stores.repository.js";
import { mapPromotion } from "./promotion.mapper.js";
import {
  getIdsFromRoot,
  logUnrecognizedFormat,
  processItems,
} from "../../utils/general.utils.js";

const parser = createParser("promotions");

export async function parsePromotionXmlFile(
  filePath: string
): Promise<Promotion[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) {
    console.log("Error in promotions : parsing file:", filePath);
    return [];
  }

  const root =
    json.Root ??
    json.root ??
    json.OrderXml?.Envelope ??
    json.Promos ??
    json.promos ??
    {};

  // Get chain, store, and sub-chain IDs from the root and filename
  const {
    chainId,
    storeId,
    subChainId: xmlSubChainId,
  } = getIdsFromRoot(root, filePath);
  if (!chainId || !storeId) return [];

  // Determine subChainId
  const subChainId =
    xmlSubChainId?.trim() ||
    (await getSubChainId(String(chainId), String(storeId)));
  if (!subChainId) return [];

  const orderLines = json.OrderXml?.Envelope?.Header?.Details?.Line;
  if (orderLines)
    return processItems(
      orderLines,
      String(chainId),
      subChainId,
      String(storeId),
      mapPromotion
    );

  const grouped = root.Promotions?.Promotion || json.Promotions?.Promotion;
  if (grouped)
    return processItems(
      grouped,
      String(chainId),
      subChainId,
      String(storeId),
      mapPromotion
    );

  const sales =
    root.Promos?.Sale || json.Promos?.Sales?.Sale || json.Promos?.Sale;
  if (sales)
    return processItems(
      sales,
      String(chainId),
      subChainId,
      String(storeId),
      mapPromotion
    );

  return logUnrecognizedFormat(filePath, "promotions.parser.ts");
}

// Helper function to get subChainId by querying the store repository
async function getSubChainId(
  chainId: string,
  storeId: string
): Promise<string | null> {
  const storeRecord = await findStoreByChainIdAndStoreId(chainId, storeId);
  return storeRecord?.SubChainId?.toString() ?? null;
}
