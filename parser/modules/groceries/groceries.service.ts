import { parseGroceryXmlFile } from "./groceries.parser.js";
import { saveGrocery } from "./groceries.repository.js";
import { getXmlDirFiles } from "../../utils/read-dir.utils.js";

export async function processAllGroceriesFiles(basePath: string) {
  const files = await getXmlDirFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    const groceries = await parseGroceryXmlFile(file);
    success++;
    if (!groceries.length) continue;

    for (const grocery of groceries) await saveGrocery(grocery);
    console.log("Saved", groceries.length, "groceries from", file);
    total += groceries.length;
  }

  console.log(
    `Processed ${success}/${files.length} files, total ${total} groceries`
  );
}
