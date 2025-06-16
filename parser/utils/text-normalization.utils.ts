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