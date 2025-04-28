import { promises as fs } from "fs";
import iconv from "iconv-lite";
import jschardet from "jschardet";

// Helper function to detect and convert file encoding
export async function readFileWithEncoding(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const detected = jschardet.detect(buffer);
  const encoding = detected.encoding || "utf-8";
  if (encoding.startsWith("UTF-16")) {
    return iconv.decode(buffer, encoding);
  }
  return buffer.toString("utf-8");
}
