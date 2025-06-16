import { parseGroceryXmlFile } from "./groceries.parser.js";
import { saveGrocery } from "../../repositories/groceries.repository.js";
import { processBatchedItems } from "../../utils/batch-processor.utils.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllGroceriesFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let totalProcessed = 0;
  let filesSuccess = 0;

  for (const file of files) {
    console.log(`groceries.service.ts: Processing ${file}...`);
    const groceries = await parseGroceryXmlFile(file);
    if (!groceries.length) continue;

    await processBatchedItems(groceries, {
      batchSize: 100,
      saveItem: saveGrocery,
    });

    filesSuccess++;
    totalProcessed += groceries.length;
  }

  console.log(
    `🏁 Processing complete: ${filesSuccess}/${files.length} files processed, ${totalProcessed} total groceries`
  );
}
