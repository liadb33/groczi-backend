import { XMLParser } from "fast-xml-parser";
import { promises as fs } from "fs";
import iconv from "iconv-lite";
import jschardet from "jschardet";

export async function readFileWithEncoding(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const detected = jschardet.detect(buffer);
  const encoding = detected.encoding || "utf-8";
  if (encoding.startsWith("UTF-16")) {
    return iconv.decode(buffer, encoding);
  }
  return buffer.toString("utf-8");
}


export async function parseXmlFile(filePath: string, parser: XMLParser): Promise<any> {
  const xmlContent = await readFileWithEncoding(filePath);
  const cleanXml = xmlContent.charCodeAt(0) === 0xfeff ? xmlContent.slice(1) : xmlContent;

  return parser.parse(cleanXml);
}



export function createParser(type: "stores" | "promotions"): XMLParser {

  const storeArrayPaths = [
    "root.subchains.subchain",
    "subchain.stores.store",
    "asx:values.stores.store",
    "store.branches.branch",
    "root.row",
  ];
  
  const promoArraySuffixes = [
  "root.promotions.promotion",
  "promotions.promotion",
  "root.promos.sale",
  "promos.sale",
  "promos.sales.sale",
  "orderxml.envelope.header.details.line",
  "promotionitems.item",
  ];
  
return new XMLParser({
  ignoreAttributes: false,
  isArray: (_name: string, jpath: string) => {
    const p = jpath.toLowerCase();
    if (type === "stores") return storeArrayPaths.includes(p);
    if (type === "promotions") return promoArraySuffixes.some((s) => p.endsWith(s));
    return false;
  },
});
}