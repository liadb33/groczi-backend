import { parseDateTime } from "../../utils/date.utils.js";
import { ensureArray } from "../../utils/array.utils.js";
import { normalizeKeys } from "../../utils/text-normalization.utils.js";
import { GroceryItem, Promotion } from "./promotion.entity.js";

export function mapPromotion(raw: Record<string, any>): Promotion {
  const data = normalizeKeys(raw);
  
  // Extract discount price from promotion level (applies to all items)
  const promotionDiscountPrice = raw.DiscountedPrice != null 
    ? parseFloat(raw.DiscountedPrice) 
    : (raw.DiscountedPricePerMida != null 
        ? parseFloat(raw.DiscountedPricePerMida) 
        : undefined);
  
  // ———————————————————————————————————————————————
  // 𝗡𝗲𝘄: handle <OrderXml>…<Line>…</Line> format
  if (raw.ItemCode != null && raw.PromotionDetails) {
    const d = raw.PromotionDetails;
    
    // For OrderXml format, check PromotionDetails for discount price
    const orderXmlDiscountPrice = d.DiscountedPrice != null 
      ? parseFloat(d.DiscountedPrice) 
      : (d.DiscountedPricePerMida != null 
          ? parseFloat(d.DiscountedPricePerMida) 
          : promotionDiscountPrice);
    
    return {
      PromotionId: String(data["promotionid"]).trim(),
      ChainId: String(data["chainid"] ?? "").trim(),
      SubChainId: String(data["subchainid"] ?? "").trim(),
      StoreId: String(data["storeid"] ?? "").trim(),

      // pull description & dates from PromotionDetails
      PromotionName: d.PromotionDescription?.trim(),
      StartDate: parseDateTime(d.PromotionStartDate),
      EndDate: parseDateTime(d.PromotionEndDate),

      // only one item per <Line> — use ItemCode + discount price from promotion level
      groceryItems: [
        {
          itemCode: String(raw.ItemCode).trim(),
          DiscountPrice: orderXmlDiscountPrice,
        },
      ],
    };
  }
  // ———————————————————————————————————————————————

  // grouped <Promotions><Promotion>…</Promotion> or
  // flat <Promos><Sale>…</Sale>
  const items = ensureArray(raw.PromotionItems?.Item);
  
  return {
    PromotionId: String(data["promotionid"]).trim(),
    ChainId: String(data["chainid"] ?? "").trim(),
    SubChainId: String(data["subchainid"] ?? "").trim(),
    StoreId: String(data["storeid"] ?? "").trim(),
    PromotionName: data["promotiondescription"]
      ? String(data["promotiondescription"]).trim()
      : undefined,
    StartDate: parseDateTime(raw.PromotionStartDate),
    EndDate: parseDateTime(raw.PromotionEndDate),
    groceryItems: items.map(
      (it: any): GroceryItem => {
        return {
          itemCode: String(it.ItemCode).trim(),
          DiscountPrice: promotionDiscountPrice, 
        };
      }
    ),
  };
}
