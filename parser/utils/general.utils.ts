import { getSubchainsByChainId } from "../repositories/stores.repository.js";
import { extractIdsFromFilename, getSubChainId } from "./extract-ids.utils.js";

export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

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

export function normalizeKeys(input: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in input) {
    const value = input[key];

    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" &&
        (value === "לא ידוע" ||
          value.toLowerCase() === "unknown"))
    ) {
      result[key.toLowerCase()] = null;
    } else {
      result[key.toLowerCase()] = value;
    }
  }
  return result;
}
export function fixHebrewEncoding(text: string): string {
  return Buffer.from(text, "latin1").toString("utf8");
}

export function normalizeStoreKeys(input: Record<string, any>): Record<string, any> {
  
  // 2. chainId, subChainId, storeId - check if each value is undefined or null then return null
  const idFields = ["chainid", "subchainid", "storeid"];
  idFields.forEach(field => {
    if (input[field] === undefined || input[field] === null || 
        String(input[field]).trim() === "") {
      input[field] = null;
    } else {
      input[field] = String(input[field]).trim();
    }
  });
  
  // 3. storeName, Address, City - remove special characters and leave only hebrew words
  const textFields = ["storename", "address", "city"];
  textFields.forEach(field => {
    if (input[field]) {
      input[field] = cleanHebrewText(String(input[field]));
    }
  });
  
  // 4. subchainName - if it's a number then copy chainName to subChainName
  if (input["subchainname"]) {
    const subChainName = String(input["subchainname"]).trim();
    // Check if subchainname is a number
    if (/^\d+$/.test(subChainName) || subChainName == null) {
      input["subchainname"] = input["chainname"] ? String(input["chainname"]).trim() : null;
    } else {
      input["subchainname"] = cleanHebrewText(subChainName);
    }
  }
  
  // Also clean chainname if it exists
  if (input["chainname"]) {
    input["chainname"] = cleanHebrewText(String(input["chainname"]));
  }
  
  return input;
}

// Helper function to clean Hebrew text - remove special characters and keep only Hebrew letters, numbers, and basic punctuation
function cleanHebrewText(text: string): string {
  if (!text) return "";
  
  // Hebrew Unicode range: U+0590-U+05FF
  // Also keep Latin letters, numbers, spaces, and basic punctuation
  const cleanedText = text
    .replace(/[^\u0590-\u05FF\u0020-\u007E\s\-.,'"]/g, '') // Keep Hebrew, ASCII, spaces, basic punctuation
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
  
  return cleanedText || "";
}


// export function normalizeGroceryKeys(input: Record<string, any>): Record<string, any> {
  
// }

