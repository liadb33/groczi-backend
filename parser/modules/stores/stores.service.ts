import { parseStoreXmlFile } from "./stores.parser.js";
import { saveStore } from "../../repositories/stores.repository.js";
import { processBatchedItems } from "../../utils/batch-processor.utils.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllStoresFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let totalProcessed = 0;
  let filesSuccess = 0;

  for (const file of files) {
    console.log(`stores.service.ts: Processing ${file}...`);
    const stores = await parseStoreXmlFile(file);
    if (!stores.length) continue;

    await processBatchedItems(stores, {
      batchSize: 100, 
      saveItem: saveStore,
    });

    filesSuccess++;
    totalProcessed += stores.length;
  }

  console.log(
    `🏁 Processing complete: ${filesSuccess}/${files.length} files processed, ${totalProcessed} total stores`
  );
}
