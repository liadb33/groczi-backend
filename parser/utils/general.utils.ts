import { getSubchainsByChainId } from "../repositories/stores.repository.js";
import { extractIdsFromFilename, getSubChainId } from "./extract-ids.utils.js";

export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export async function getIdsFromRoot(
  root: any,
  filePath: string
): Promise<{
  chainId: string | null;
  storeId: string | null;
  subChainId: string | null;
}> {
  const xmlChainRaw = root.ChainId ?? root.ChainID ?? "";
  const xmlSubRaw = root.SubChainId ?? root.SubChainID ?? "";
  const xmlStoreRaw = root.StoreId ?? root.StoreID ?? "";

  const xmlChain = String(xmlChainRaw).trim();
  const xmlSub = String(xmlSubRaw).trim();
  const xmlStore = String(xmlStoreRaw).trim();

  const { chainId: fileChain, storeId: fileStore } =
    extractIdsFromFilename(filePath);

  const chainId = xmlChain || fileChain;
  const storeId = xmlStore || fileStore;

  let subChainId =
    xmlSub?.trim() || (await getSubChainId(String(chainId), String(storeId)));

  if (chainId) {
    const subChains = await getSubchainsByChainId(chainId);
    const subChain = subChains.find((sub) => sub.SubChainId === xmlSub);
    if (subChain) {
      return { chainId, storeId, subChainId: xmlSub };
    } else if (subChains.length === 0) {
      console.log(
        "No subchains found for chainId:",
        chainId,
        "and storeId:",
        storeId
      );
      return { chainId, storeId, subChainId: null };
    } else if (xmlSub && !subChain) {
      console.log(
        "No matching subchain found for chainId:",
        chainId,
        "and storeId:",
        storeId
      );
      return {
        chainId,
        storeId,
        subChainId: subChains.length === 1 ? subChains[0].SubChainId : null,
      };
    }
  }

  return { chainId, storeId, subChainId };
}

// Fallback function when no matching format is found
export function logUnrecognizedFormat(filePath: string, type: string): [] {
  console.log(
    "No Items found in:",
    type,
    ":",
    filePath,
    "check the file format"
  );
  return [];
}

export function normalizeKeys(input: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in input) {
    result[key.toLowerCase()] = input[key];
  }
  return result;
}
