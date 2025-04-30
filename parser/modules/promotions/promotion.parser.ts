import { XMLParser } from "fast-xml-parser";
import { Promotion } from "./promotion.entity.js"; 
import { readFileWithEncoding } from "../../utils/encoding.utils.js"; // אם יש לך פונקציה לקרוא קבצים

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (jpath: string) => {
    const arrayPaths = [
      "Promotions.Promotion",
      "Promotion.PromotionItems.Item", // תוודא שה־parser יודע לזהות גם פריטים כאן
    ];
    return arrayPaths.includes(jpath);
  },
});

export function mapToPromotion(input: Record<string, any>): Promotion {
  const result: Partial<Promotion> = {};
  
  // מיפוי שדות
  result.PromotionId = input.PromotionId;
  result.PromotionName = input.PromotionDescription;
  result.StartDate = input.PromotionStartDate ? new Date(input.PromotionStartDate) : undefined;
  result.EndDate = input.PromotionEndDate ? new Date(input.PromotionEndDate) : undefined;
  
  // טיפול בפרטי ההנחות והפריטים
  if (input.PromotionItems?.Item) {
    const items = Array.isArray(input.PromotionItems.Item) ? input.PromotionItems.Item : [input.PromotionItems.Item];
    result.groceryItems = items.map((item: any) => ({
      itemCode: BigInt(item.ItemCode),
      DiscountPrice: parseFloat(item.DiscountedPrice) || undefined,
      IsGiftItem: item.IsGiftItem === '1', // מתייחס למתנה אם יש
    }));
  }

  return result as Promotion;
}

export async function parsePromotionXmlFile(filePath: string): Promise<Promotion[]> {
  const xmlContent = await readFileWithEncoding(filePath);
  const cleanXml = xmlContent.charCodeAt(0) === 0xfeff ? xmlContent.slice(1) : xmlContent;
  const json = parser.parse(cleanXml);

  console.log("Parsed JSON:", JSON.stringify(json, null, 2)); // הוספנו כדי לבדוק את התוצאה של ה־parser

  if (!json || !json.Promotions?.Promotion) return [];

  const promotions = Array.isArray(json.Promotions.Promotion)
    ? json.Promotions.Promotion
    : [json.Promotions.Promotion];

  return promotions.map(mapToPromotion);
}
