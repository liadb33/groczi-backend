import { Promotion } from "./promotion.entity.js";
import { createParser, parseXmlFile } from "../../utils/xml-parser.utils.js";
import { findStoreByChainIdAndStoreId } from "../../repositories/stores.repository.js";
import { mapPromotion } from "./promotion.mapper.js";
import {
  ensureArray,
  getIdsFromRoot,
  logUnrecognizedFormat,
} from "../../utils/general.utils.js";

const parser = createParser("promotions");

function normalizeChainId(raw: string | number): string | null {
  const id = String(raw).trim();

  // Accept only 7 to 13 digit numeric strings
  if (!/^\d{7,13}$/.test(id)) {
    console.warn(`❌ Invalid chainId: ${id}`);
    return null;
  }

  return id;
}

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

  // Extract IDs from root object
  const xmlChainRaw = root.ChainId ?? root.ChainID ?? "";
  const xmlSubRaw = root.SubChainId ?? root.SubChainID ?? "";
  const xmlStoreRaw = root.StoreId ?? root.StoreID ?? "";

  // Get chain, store, and sub-chain IDs from the root and filename
  let {
    chainId,
    storeId,
    subChainId: xmlSubChainId,
  } = await getIdsFromRoot(xmlChainRaw, xmlStoreRaw, xmlSubRaw, filePath);

  if (!chainId || storeId == null || xmlSubChainId == null) return [];

  const normalizedChainId = normalizeChainId(chainId);
  if (!normalizedChainId) return [];
  chainId = normalizedChainId;

  const orderLines = json.OrderXml?.Envelope?.Header?.Details?.Line;
  if (orderLines) {
    const arr = ensureArray(orderLines);
    return arr.map((item) =>
      mapPromotion({ ...item, chainId, subChainId: xmlSubChainId, storeId })
    );
  }

  const grouped = root.Promotions?.Promotion || json.Promotions?.Promotion;
  if (grouped) {
    const arr = ensureArray(grouped);
    return arr.map((item) =>
      mapPromotion({ ...item, chainId, subChainId: xmlSubChainId, storeId })
    );
  }

  const sales =
    root.Promos?.Sale || json.Promos?.Sales?.Sale || json.Promos?.Sale;
  if (sales) {
    const arr = ensureArray(sales);
    return arr.map((item) =>
      mapPromotion({ ...item, chainId, subChainId: xmlSubChainId, storeId })
    );
  }

  return logUnrecognizedFormat(filePath, "promotions.parser.ts");
}
