import { parseGroceryXmlFile } from "./groceries.parser.js";
import { getAllGroceriesXmlFiles } from "./groceries.reader.js";
import { saveGrocery } from "../../repositories/groceries.repository.js";

export async function processAllGroceriesFiles(basePath: string) {
  const files = await getAllGroceriesXmlFiles(basePath);

  let total = 0;
  let success = 0;

  for (const file of files) {
    const groceries = await parseGroceryXmlFile(file);
    //console.log(groceries);
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
