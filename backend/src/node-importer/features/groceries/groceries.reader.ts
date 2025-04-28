import fs from "fs-extra";
import path from "path";

export async function getAllGroceriesXmlFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await getAllGroceriesXmlFiles(fullPath);
      results = results.concat(subFiles);
    } else if (entry.isFile() && fullPath.endsWith(".xml")) {
      results.push(fullPath);
    }
  }
  return results;
}
