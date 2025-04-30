import path from "path";
import prisma from "../../database/prismaClient.js";

import { fileURLToPath } from "url";
import { processAllGroceriesFiles } from "./groceries.service.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

async function run() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const basePath = path.join(
      dirname,
      "..",
      "..",
      "..",
      "scraper-engine",
      "output",
      "groceries"
    );
    await processAllGroceriesFiles(basePath);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
