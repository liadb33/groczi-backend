import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import util from "util";

const prisma = new PrismaClient();
const execFileAsync = util.promisify(execFile);

async function getImageUrl(
  itemcode: string | null,
  itemname: string
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("python", [
      "../../images-scraper/test.py",
      itemcode ?? "",
      itemname ?? "",
    ]);
    const url = stdout.trim();
    return url || null;
  } catch (err) {
    console.error("Python error:", err);
    return null;
  }
}

async function main() {
  const groceries = await prisma.grocery.findMany({
    where: { imageUrl: null },
    select: { itemCode: true, itemName: true },
  });
  for (const grocery of groceries) {
    if (grocery.itemCode === null || grocery.itemName === null) {
      console.log(`❌ Skipping grocery with missing itemCode or itemName`);
      continue;
    }

    const imageUrl = await getImageUrl(grocery.itemCode, grocery.itemName);
    if (imageUrl) {
      await prisma.grocery.update({
        where: { itemCode: grocery.itemCode },
        data: { imageUrl },
      });
      console.log(`✔️ Updated image for ${grocery.itemName}`);
    } else {
      console.log(`❌ No image found for ${grocery.itemName}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
