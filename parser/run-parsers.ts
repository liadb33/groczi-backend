import path from "path";
import { fileURLToPath } from "url";
import prisma from "./prisma-client/prismaClient.js";

import { processAllGroceriesFiles } from "./modules/groceries/groceries.service.js";
import { processAllPromotionsFiles } from "./modules/promotions/promotion.service.js";
import { processAllStoresFiles } from "./modules/stores/stores.service.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const args = process.argv.slice(2);

async function run() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const actions = new Set(args);

   if (actions.has("stores")) {
      const storesPath = path.join(dirname, "..", "scraper-engine", "output", "stores");
      console.log("🏬 Processing stores...");
      await processAllStoresFiles(storesPath);
   }

   if (actions.has("groceries")) {
      const groceriesPath = path.join(dirname, "..", "scraper-engine", "output", "groceries");
      console.log("🥬 Processing groceries...");
      await processAllGroceriesFiles(groceriesPath);
   }

    if (actions.has("promotions")) {
      const promotionsPath = path.join(dirname, "..", "scraper-engine", "output", "promotions");
      console.log("💸 Processing promotions...");
      await processAllPromotionsFiles(promotionsPath);
   }


    console.log("✅ All data processed successfully.");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
