import { getAllStoresXmlFiles } from "./stores.reader.js";
import { parseStoreXmlFile } from "./stores.parser.js";
import { saveStore } from "../../database/repositories/stores.repository.js";

export async function processAllStoresFiles(basePath: string) {
  const files = await getAllStoresXmlFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    const stores = await parseStoreXmlFile(file);

    if (!stores.length) continue;

    for (const store of stores) await saveStore(store);

    success++;
    total += stores.length;
  }

  console.log(
    `Processed ${success}/${files.length} files, total ${total} stores`
  );
}
