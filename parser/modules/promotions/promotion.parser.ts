import { Promotion, GroceryItem } from "./promotion.entity.js";
import { createParser, parseXmlFile, readFileWithEncoding } from "../../utils/xml-parser.utils.js";
import { findStoreByChainIdAndStoreId } from "../stores/stores.repository.js";
import { extractIdsFromFilename } from "../../utils/extract-ids.utils.js";
import { mapPromotion } from "./promotion.mapper.js";

const parser = createParser("promotions");

export async function parsePromotionXmlFile(
  filePath: string
): Promise<Promotion[]> {
  const json = await parseXmlFile(filePath, parser);
  if (!json) return [];

  const root =
    json.Root ??
    json.root ??
    json.OrderXml?.Envelope ??
    json.Promos ??
    json.promos ??
    {};
    
  const xmlChain = Number(root.ChainId ?? root.ChainID ?? null);
  const xmlSub = Number(root.SubChainId ?? root.SubChainID ?? null);
  const xmlStore = Number(root.StoreId ?? root.StoreID ?? null);

  const { chainId: fileChain, storeId: fileStore } =
    extractIdsFromFilename(filePath);

  const chainId = xmlChain || fileChain;
  const storeId = xmlStore || fileStore;
  if (!chainId || !storeId) return [];
  let subChainId = xmlSub;
  if (subChainId == null) {
    const storeRecord = await findStoreByChainIdAndStoreId(chainId, storeId);
    if (!storeRecord) return [];
    subChainId = storeRecord.SubChainId;
  }

  const orderLines = json.OrderXml?.Envelope?.Header?.Details?.Line;
  if (orderLines) {
    const arr = Array.isArray(orderLines) ? orderLines : [orderLines];
    return arr.map((line) => mapPromotion(line, chainId, subChainId, storeId));
  }

  const grouped = root.Promotions?.Promotion || json.Promotions?.Promotion;
  if (grouped) {
    const arr = Array.isArray(grouped) ? grouped : [grouped];
    return arr.map((raw) => mapPromotion(raw, chainId, subChainId, storeId));
  }

  const sales = root.Promos?.Sale || json.Promos?.Sales?.Sale || json.Promos?.Sale;
  if (sales) {
    const arr = Array.isArray(sales) ? sales : [sales];
    return arr.map((raw) => mapPromotion(raw, chainId, subChainId, storeId));
  }

  return [];
}
