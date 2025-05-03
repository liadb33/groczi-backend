import { getXmlDirFiles } from "../../utils/read-dir.utils.js";
import { parsePromotionXmlFile } from "./promotion.parser.js";
import { savePromotion } from "./promotions.repository.js";

export async function processAllPromotionsFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    const promotions = await parsePromotionXmlFile(file);
    console.log(promotions);
    success++;
    if (!promotions.length) continue;

    for (const grocery of promotions) //await savePromotion(grocery);
      console.log("Saved", promotions.length, "promotions from", file);
    total += promotions.length;
  }

  console.log(
    `Processed ${success}/${files.length} files, total ${total} groceries`
  );
}
