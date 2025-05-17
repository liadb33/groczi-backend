import { categories } from "../constants/categories.js";

function normalizeText(text: string): string {
  return text
    .normalize('NFD') // מפרק ניקוד לדמויות נפרדות
    .replace(/[\u0591-\u05C7]/g, '') // מסיר ניקוד
    .replace(/[׳׳']/g, '') // מסיר גרשים
    .replace(/\s+/g, ' ') // ממזג רווחים מיותרים
    .trim()
}

export function categorizeProduct(productName: string): string | null {
  const normalizedName = normalizeText(productName);

  for (const category of categories) {
    for (const regex of category.keywords) {
      if (regex.test(normalizedName)) 
        return category.name;
    }
  }
  return null;  
}