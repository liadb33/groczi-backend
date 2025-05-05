import path from 'path';

export function extractIdsFromFilename(filePath: string): {
  chainId: number | null;
  storeId: number | null;
} {
  const fileName = path.basename(filePath);

  // Match prefixes: promo, promofull, price, pricefull
  const match = fileName.match(/^(promo|promofull|price|pricefull)(\d+)-(\d+)-/i);
  if (match) {
    return {
      chainId: Number(match[2]),
      storeId: Number(match[3]),
    };
  }

  return { chainId: null, storeId: null };
}
