import { parseStoreXmlFile } from "./stores.parser.js";
import { saveStore } from "../../repositories/stores.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllStoresFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);
  let total = 0;
  let success = 0;
  for (const file of files) {
    const stores = await parseStoreXmlFile(file);
    if (!stores.length) continue;

    console.log(`stores.service.ts: Processing ${file}...`);

    for (const store of stores) await saveStore(store);

    success++;
    total += stores.length;
  }
  console.log(
    `Processed ${success}/${files.length} files, total ${total} stores`
  );
}
