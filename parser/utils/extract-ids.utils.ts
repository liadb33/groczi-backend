import path from "path";
import { findStoreByChainIdAndStoreId } from "../repositories/stores.repository.js";

export function extractIdsFromFilename(filePath: string): {
  chainId: string | null;
  storeId: string | null;
} {
  const fileName = path.basename(filePath);

  // Match prefixes: promo, promofull, price, pricefull
  const match = fileName.match(
    /^(promo|promofull|price|pricefull)(\d+)-(\d+)-/i
  );
  if (match) {
    return {
      chainId: String(match[2]).trim(),
      storeId: String(match[3]).trim(),
    };
  }

  return { chainId: null, storeId: null };
}

// Helper function to get subChainId by querying the store repository
export async function getSubChainId(
  chainId: string,
  storeId: string
): Promise<string | null> {
  const storeRecord = await findStoreByChainIdAndStoreId(chainId, storeId);
  return storeRecord?.SubChainId?.toString() ?? null;
}
