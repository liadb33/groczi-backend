import { parseGroceryXmlFile } from "./groceries.parser.js";
import { saveGrocery } from "../../repositories/groceries.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

// Helper function to split array into batches
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function processAllGroceriesFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let totalProcessed = 0;
  let totalSaved = 0;
  let filesSuccess = 0;

  for (const file of files) {
    console.log(`groceries.service.ts: Processing ${file}...`);
    const groceries = await parseGroceryXmlFile(file);
    if (!groceries.length) continue;

    console.log(`💾 Saving ${groceries.length} groceries using batched parallel processing...`);
    
    // Batch parallel processing instead of sequential
    const BATCH_SIZE = 100;
    const batches = chunkArray(groceries, BATCH_SIZE);
    let savedInFile = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;
      
      
      // Process all items in this batch in parallel
      const savePromises = batch.map(async (grocery) => {
        try {
          await saveGrocery(grocery);
          return { success: true, itemCode: grocery.itemCode };
        } catch (err) {
          console.error(`❌ Failed to save grocery ${grocery.itemCode}:`, err);
          return { success: false, itemCode: grocery.itemCode, error: err };
        }
      });

      // Wait for all items in this batch to complete
      const results = await Promise.all(savePromises);
      
      // Count successes in this batch
      const batchSuccesses = results.filter(r => r.success).length;
      const batchFailures = results.filter(r => !r.success).length;
      
      savedInFile += batchSuccesses;
      
    }

    filesSuccess++;
    totalProcessed += groceries.length;
    totalSaved += savedInFile;
    
    console.log(`🎉 File completed: ${savedInFile}/${groceries.length} groceries saved`);
  }

  console.log(
    `🏁 Processing complete: ${filesSuccess}/${files.length} files processed, ${totalSaved}/${totalProcessed} groceries saved`
  );
}
