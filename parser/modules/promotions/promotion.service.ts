import { parsePromotionXmlFile } from "./promotion.parser.js";
import { savePromotion } from "../../repositories/promotions.repository.js";
import { processBatchedItems } from "../../utils/batch-processor.utils.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllPromotionsFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let totalProcessed = 0;
  let filesSuccess = 0;

  for (const file of files) {
    console.log(`promotion.service.ts: Processing ${file}...`);
    const promotions = await parsePromotionXmlFile(file);
    if (!promotions.length) continue;

    await processBatchedItems(promotions, {
      batchSize: 100, 
      saveItem: savePromotion,
    });

    filesSuccess++;
    totalProcessed += promotions.length;
  }

  console.log(
    `🏁 Processing complete: ${filesSuccess}/${files.length} files processed, ${totalProcessed} total promotions`
  );
}
