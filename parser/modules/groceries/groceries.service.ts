import { parseGroceryXmlFile } from "./groceries.parser.js";
import { saveGrocery } from "../../repositories/groceries.repository.js";
import { getXmlDirFiles } from "../../utils/file-system.utils.js";

export async function processAllGroceriesFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    console.log(`groceries.service.ts: Processing ${file}...`);
    const groceries = await parseGroceryXmlFile(file);
    if (!groceries.length) continue;

    for (const grocery of groceries) {
      try {
        await saveGrocery(grocery);
      } catch (err) {
        console.error(`❌ Failed to save grocery ${grocery.itemCode}:`, err);
        continue; 
      }
    }
    success++;
    total += groceries.length;
  }

  console.log(
    `Processed ${success}/${files.length} files, total ${total} groceries`
  );
}
