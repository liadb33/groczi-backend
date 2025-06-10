import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import util from "util";

const prisma = new PrismaClient();
const execFileAsync = util.promisify(execFile);

// Generic helper: pass mode + args
async function fetchImage(
  mode: "product" | "subchain",
  args: string[]
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("python", [
      "../../images-scraper/find_image.py",
      mode,
      ...args,
    ]);
    const url = stdout.trim();
    return url || null;
  } catch (err) {
    console.error(`Python error [${mode}]:`, err);
    return null;
  }
}

async function getProductImageUrl(itemcode: string, itemname: string) {
  return fetchImage("product", [itemcode, itemname]);
}

async function getSubChainImageUrl(subchainname: string) {
  return fetchImage("subchain", [subchainname]);
}

async function main() {
  // const groceries = await prisma.grocery.findMany({
  //   where: { imageUrl: null },
  //   select: { itemCode: true, itemName: true },
  // });

  // for (const { itemCode, itemName } of groceries) {
  //   if (!itemCode || !itemName) continue;
  //   const imageUrl = await getProductImageUrl(itemCode, itemName);
  //   if (imageUrl) {
  //     await prisma.grocery.update({
  //       where: { itemCode },
  //       data: { imageUrl },
  //     });
  //     console.log(`✔️ Product image updated: ${itemName}`);
  //   } else {
  //     console.log(`❌ No image for product: ${itemName}`);
  //   }
  // }

  const subchains = await prisma.subchains.findMany({
    where: { imageUrl: null },
    select: { SubChainId: true, SubChainName: true, ChainId: true },
  });

  for (const { SubChainId, SubChainName, ChainId } of subchains) {
    if (!SubChainName) continue;
    const imageUrl = await getSubChainImageUrl(SubChainName);
    if (imageUrl) {
      await prisma.subchains.update({
        where: {
          ChainId_SubChainId: {
            ChainId,
            SubChainId,
          },
        },
        data: { imageUrl },
      });
      console.log(`✔️ Sub Chain image updated: ${SubChainName}`);
    } else {
      console.log(`❌ No image for Sub Chain: ${SubChainName}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
