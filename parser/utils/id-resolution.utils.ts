import { getSubchainsByChainId } from "../repositories/stores.repository.js";
import { extractIdsFromFilename, getSubChainId } from "./extract-ids.utils.js";

export async function getIdsFromRoot(
  inputChainId: string,
  inputStoreId: string,
  inputSubChainId: string,
  filePath: string
): Promise<{
  chainId: string | null;
  storeId: string | null;
  subChainId: string | null;
}> {
  // Get IDs from filename as fallback
  const { chainId: fileChain, storeId: fileStore } =
    extractIdsFromFilename(filePath);

  // Convert inputs to strings and use input IDs or fallback to file-extracted IDs
  const chainId = String(inputChainId || "").trim() || fileChain;
  const storeId = String(inputStoreId || "").trim() || fileStore;

  let subChainId =
    String(inputSubChainId || "").trim() || (await getSubChainId(String(chainId), String(storeId)));

  if (chainId) {
    const subChains = await getSubchainsByChainId(chainId);
    const subChain = subChains.find((sub) => sub.SubChainId === String(inputSubChainId || "").trim());
    
    if (subChain) {
      return { chainId, storeId, subChainId: String(inputSubChainId || "").trim() };
    } else if (subChains.length === 0) {
      console.log(
        "No subchains found for chainId:",
        chainId,
        "and storeId:",
        storeId
      );
      return { chainId, storeId, subChainId: null };
    } else if (inputSubChainId && !subChain) {
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