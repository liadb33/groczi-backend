import { parsePromotionXmlFile } from "./promotion.parser.js";
import { savePromotion } from "../../repositories/promotions.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllPromotionsFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    console.log(`promotion.service.ts: Processing ${file}...`);
    const promotions = await parsePromotionXmlFile(file);
    if (!promotions.length) continue;
    
    for (const promo of promotions){
      try {
        await savePromotion(promo);
      } catch (err) {
        console.error(`❌ Failed to save promotion ${promo.PromotionId}:`, err);
        continue; 
      }
    }
    success++;
    total += promotions.length;
  }

  console.log(
    `Processed ${success}/${files.length} files, total ${total} promotions`
  );
}
