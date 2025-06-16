import { parseStoreXmlFile } from "./stores.parser.js";
import { saveStore } from "../../repositories/stores.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllStoresFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);
  let total = 0;
  let success = 0;
  
  for (const file of files) {
    console.log(`stores.service.ts: Processing ${file}...`);
    const stores = await parseStoreXmlFile(file);
    if (!stores.length) continue;

    for (const store of stores) {
      try {
        await saveStore(store);
      } catch (error) {
        console.error(`❌ Failed to save store: ${store.StoreId}`, error);
      }
    }

    success++;
    total += stores.length;
  }
  console.log(
    `Processed ${success}/${files.length} files, total ${total} stores`
  );
}
