import { extractIdsFromFilename } from "./extract-ids.utils.js";

export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function getIdsFromRoot(root: any, filePath: string) {
  const xmlChain = root.ChainId ?? root.ChainID ?? "";
  const xmlSub = root.SubChainId ?? root.SubChainID ?? "";
  const xmlStore = root.StoreId ?? root.StoreID ?? "";

  const { chainId: fileChain, storeId: fileStore } =
    extractIdsFromFilename(filePath);

  const chainId = xmlChain.trim() || fileChain;
  const storeId = xmlStore.trim() || fileStore;

  return { chainId, storeId, subChainId: xmlSub.trim() };
}

export function processItems<T>(
  items: any,
  chainId: string,
  subChainId: string,
  storeId: string,
  mapFunction: (
    raw: any,
    chainId: string,
    subChainId: string,
    storeId: string
  ) => T
): T[] {
  const arr = ensureArray(items);
  return arr.map((raw) => mapFunction(raw, chainId, subChainId, storeId));
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
