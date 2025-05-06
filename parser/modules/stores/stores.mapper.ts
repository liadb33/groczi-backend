import { Store } from "./store.entity";

const storeKeys: (keyof Store)[] = [
  "ChainId",
  "SubChainId",
  "StoreId",
  "StoreName",
  "Address",
  "City",
  "ZipCode",
  "StoreType",
  "ChainName",
  "SubChainName",
];

const numberKeys: (keyof Store)[] = [
  "ChainId",
  "SubChainId",
  "StoreId",
  "StoreType",
];

export function mapToStore(input: Record<string, any>): Store {
  const result: Partial<Store> = {};

  for (const key of storeKeys) {
    const rawKey = key as string;
    let value =
      input[rawKey] ??
      input[rawKey.toUpperCase?.()] ??
      input[rawKey.toLowerCase?.()] ??
      0;

    if (numberKeys.includes(key)) {
      const num = parseInt(value);
      if (!isNaN(num)) {
        result[key as keyof Store] = num as any;
      }
    } else {
      result[key as keyof Store] = String(value).trim() as any;
    }
  }
  const scn = result.SubChainName?.trim() ?? "";
  if (!scn || /^\d+$/.test(scn)) 
    result.SubChainName = result.ChainName;
  

  return result as Store;
}
