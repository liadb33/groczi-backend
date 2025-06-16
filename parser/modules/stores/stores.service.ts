import { parseStoreXmlFile } from "./stores.parser.js";
import { saveStore } from "../../repositories/stores.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

// Helper function to split array into batches
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function processAllStoresFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let totalProcessed = 0;
  let totalSaved = 0;
  let filesSuccess = 0;
  
  for (const file of files) {
    console.log(`stores.service.ts: Processing ${file}...`);
    const stores = await parseStoreXmlFile(file);
    if (!stores.length) continue;

    
    // Batch parallel processing instead of sequential
    const BATCH_SIZE = 75; // Medium batch size for stores
    const batches = chunkArray(stores, BATCH_SIZE);
    let savedInFile = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;
      
      // Process all items in this batch in parallel
      const savePromises = batch.map(async (store) => {
        try {
          await saveStore(store);
          return { success: true, storeId: store.StoreId };
        } catch (error) {
          console.error(`❌ Failed to save store: ${store.StoreId}`, error);
          return { success: false, storeId: store.StoreId, error };
        }
      });

      // Wait for all items in this batch to complete
      const results = await Promise.all(savePromises);
      
      // Count successes in this batch
      const batchSuccesses = results.filter(r => r.success).length;
      const batchFailures = results.filter(r => !r.success).length;
      
      savedInFile += batchSuccesses;
      
      console.log(`  ✅ Batch ${batchNumber} completed: ${batchSuccesses} saved, ${batchFailures} failed`);
    }

    filesSuccess++;
    totalProcessed += stores.length;
    totalSaved += savedInFile;
    
    console.log(`🎉 File completed: ${savedInFile}/${stores.length} stores saved`);
  }

  console.log(
    `🏁 Processing complete: ${filesSuccess}/${files.length} files processed, ${totalSaved}/${totalProcessed} stores saved`
  );
}
