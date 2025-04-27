import { getAllGroceriesXmlFiles } from "./Groceries.reader";

export async function processAllGroceriesFiles(basePath: string) {
  const files = await getAllGroceriesXmlFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    const stores = await parseGroceryXmlFile(file);

    if (!stores.length) continue;

    for (const store of stores) await saveGrocery(store);

    success++;
    total += stores.length;
  }

  console.log(
    `Processed ${success}/${files.length} files, total ${total} stores`
  );
}
