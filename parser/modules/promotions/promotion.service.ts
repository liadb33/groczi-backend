import { parsePromotionXmlFile } from "./promotion.parser.js";
import { savePromotion } from "../../repositories/promotions.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

// Helper function to split array into batches
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function processAllPromotionsFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let totalProcessed = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  let filesSuccess = 0;

  for (const file of files) {
    console.log(`promotion.service.ts: Processing ${file}...`);
    const promotions = await parsePromotionXmlFile(file);
    if (!promotions.length) continue;

    console.log(`💾 Saving ${promotions.length} promotions using batched parallel processing...`);
    
    // Batch parallel processing instead of sequential
    const BATCH_SIZE = 50; // Smaller batch size for promotions (they might be more complex)
    const batches = chunkArray(promotions, BATCH_SIZE);
    let savedInFile = 0;
    let skippedInFile = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;
      
      
      // Process all items in this batch in parallel
      const savePromises = batch.map(async (promo) => {
        try {
          const wasSuccessful = await savePromotion(promo);
          return { 
            success: wasSuccessful, 
            promotionId: promo.PromotionId,
            saved: wasSuccessful,
            skipped: !wasSuccessful
          };
        } catch (err) {
          console.error(`❌ Failed to save promotion ${promo.PromotionId}:`, err);
          return { 
            success: false, 
            promotionId: promo.PromotionId, 
            error: err,
            saved: false,
            skipped: false
          };
        }
      });

      // Wait for all items in this batch to complete
      const results = await Promise.all(savePromises);
      
      // Count successes and skips in this batch
      const batchSaved = results.filter(r => r.saved).length;
      const batchSkipped = results.filter(r => r.skipped).length;
      const batchFailed = results.filter(r => r.error).length;
      
      savedInFile += batchSaved;
      skippedInFile += batchSkipped;
      
      console.log(`  ✅ Batch ${batchNumber} completed: ${batchSaved} saved, ${batchSkipped} skipped (no groceries), ${batchFailed} failed`);
    }

    filesSuccess++;
    totalProcessed += promotions.length;
    totalSaved += savedInFile;
    totalSkipped += skippedInFile;
    
    console.log(`🎉 File completed: ${savedInFile} saved, ${skippedInFile} skipped / ${promotions.length} total promotions`);
  }

  console.log(
    `🏁 Processing complete: ${filesSuccess}/${files.length} files processed, ${totalSaved} saved, ${totalSkipped} skipped / ${totalProcessed} total promotions`
  );
}
