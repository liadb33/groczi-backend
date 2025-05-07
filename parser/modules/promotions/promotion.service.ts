import { parsePromotionXmlFile } from "./promotion.parser.js";
import { savePromotion } from "../../repositories/promotions.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllPromotionsFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    const promotions = await parsePromotionXmlFile(file);
    console.log(promotions);
    success++;
    if (!promotions.length) {
      console.log("No promotions found in", file);
      continue;
    }

    //console.log("Saved", promotions.length, "promotions from", file);
    //for (const grocery of promotions) //await savePromotion(grocery);

    total += promotions.length;
  }

  console.log(
    `Processed ${success}/${files.length} files, total ${total} promotions`
  );
}
