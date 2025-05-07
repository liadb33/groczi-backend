import { ensureArray } from "../../utils/general.utils.js";
import { GroceryItem, Promotion } from "./promotion.entity.js";

export function mapPromotion(
  raw: any,
  chainId: string,
  subChainId: string,
  storeId: string
): Promotion {
  // ———————————————————————————————————————————————
  // 𝗡𝗲𝘄: handle <OrderXml>…<Line>…</Line> format
  if (raw.ItemCode != null && raw.PromotionDetails) {
    const d = raw.PromotionDetails;
    return {
      PromotionId: String(raw.PromotionId || raw.PromotionID).trim(),
      ChainId: chainId,
      SubChainId: subChainId,
      StoreId: storeId,

      // pull description & dates from PromotionDetails
      PromotionName: d.PromotionDescription?.trim(),
      StartDate: d.PromotionStartDate
        ? new Date(`${d.PromotionStartDate}T${d.PromotionStartHour}`)
        : undefined,
      EndDate: d.PromotionEndDate
        ? new Date(`${d.PromotionEndDate}T${d.PromotionEndHour}`)
        : undefined,

      // only one item per <Line> — use ItemCode + DiscountedPrice
      groceryItems: [
        {
          itemCode: String(raw.ItemCode).trim(),
          DiscountPrice:
            d.DiscountedPrice != null
              ? parseFloat(d.DiscountedPrice)
              : undefined,
        },
      ],
    };
  }
  // ———————————————————————————————————————————————

  // grouped <Promotions><Promotion>…</Promotion> or
  // flat <Promos><Sale>…</Sale>
  const items = ensureArray(raw.PromotionItems?.Item);

  return {
    PromotionId: String(raw.PromotionId || raw.PromotionID).trim(),
    ChainId: chainId,
    SubChainId: subChainId,
    StoreId: storeId,
    PromotionName: (raw.PromotionDescription || raw.PromotionName)?.trim(),
    StartDate: raw.PromotionStartDate
      ? new Date(
          `${raw.PromotionStartDate}T${raw.PromotionStartHour ?? "00:00:00"}`
        )
      : undefined,
    EndDate: raw.PromotionEndDate
      ? new Date(
          `${raw.PromotionEndDate}T${raw.PromotionEndHour ?? "23:59:59"}`
        )
      : undefined,
    groceryItems: items.map(
      (it: any): GroceryItem => ({
        itemCode: String(it.ItemCode).trim(),
        DiscountPrice:
          it.DiscountedPrice != null
            ? parseFloat(it.DiscountedPrice)
            : undefined,
      })
    ),
  };
}
