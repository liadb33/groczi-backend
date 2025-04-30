import path from "path";
import { fileURLToPath } from "url";
import { processAllStoresFiles } from "./stores.service.js";
import prisma from "../../database/prismaClient.js";

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
      "stores"
    );
    await processAllStoresFiles(basePath);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
