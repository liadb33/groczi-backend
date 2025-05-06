import { Store } from "../modules/stores/store.entity.js";
import { extractIdsFromFilename } from "./extract-ids.utils.js";


export function ensureArray<T>(value: T | T[]): T[] {
    return Array.isArray(value) ? value : value ? [value] : [];
}

// Utility function to extract chain, store, and sub-chain ID
export function getIdsFromRoot(root: any, filePath: string) {
  const xmlChain = Number(root.ChainId ?? root.ChainID ?? null);
  const xmlSub = Number(root.SubChainId ?? root.SubChainID ?? null);
  const xmlStore = Number(root.StoreId ?? root.StoreID ?? null);

  const { chainId: fileChain, storeId: fileStore } = extractIdsFromFilename(filePath);

  const chainId = xmlChain || fileChain;
  const storeId = xmlStore || fileStore;

  return { chainId, storeId, subChainId: xmlSub };
}

export function processItems<T>(items: any, chainId: number, subChainId: number, storeId: number, mapFunction: (raw: any, chainId: number, subChainId: number, storeId: number) => T): T[] {
    const arr = ensureArray(items);
    return arr.map((raw) => mapFunction(raw, chainId, subChainId, storeId));
}

// Fallback function when no matching format is found
export function logUnrecognizedFormat(filePath: string,type:string): [] {
    console.log("No Items found in:",type,":", filePath, "check the file format");
    return [];
  }
  