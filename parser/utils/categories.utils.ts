import { categories } from "../constants/categories.js";
import prisma from "../prisma-client/prismaClient.js";
import { Parser } from "json2csv";
import fs from "fs";

const parser = new Parser({ fields: ["name", "category"] });
let counter = 0;
export async function run() {
  const products = await prisma.grocery.findMany();
  const cataloged = products.map((p) => ({
    name: p.itemName,
    category: categorizeProduct(p.itemName),
  }));
  for (const product of cataloged) {
    if (product.category == "אחר") {
      counter++;
      console.log(product);
    }
  }
  console.log("Total products with 'אחר' category: ", counter);
  const csv = parser.parse(cataloged);
  fs.writeFileSync("categorized-products.csv", csv);
}

function categorizeProduct(productName: string | null): string | null {
  for (const category of categories) {
    if (
      category.keywords.some((regex) =>
        regex.test(productName ? productName : "")
      )
    ) {
      return category.name;
    }
  }
  return "אחר"; // ברירת מחדל
}

run();

// function normalizeText(text: string): string {
//   return text
//     .normalize('NFD') // מפרק ניקוד לדמויות נפרדות
//     .replace(/[\u0591-\u05C7]/g, '') // מסיר ניקוד
//     .replace(/[׳׳']/g, '') // מסיר גרשים
//     .replace(/\s+/g, ' ') // ממזג רווחים מיותרים
//     .trim()
// }

// export function categorizeProduct(productName: string): string | null {
//   const normalizedName = normalizeText(productName);

//   for (const category of categories) {
//     for (const regex of category.keywords) {
//       if (regex.test(normalizedName))
//         return category.name;
//     }
//   }
//   return null;
// }
