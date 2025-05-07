import { ensureArray } from "../../utils/general.utils";
import { GroceryItem, Promotion } from "./promotion.entity";

export function mapPromotion(
  raw: any,
  chainId: number,
  subChainId: number,
  storeId: number
): Promotion {
  // ———————————————————————————————————————————————
  // 𝗡𝗲𝘄: handle <OrderXml>…<Line>…</Line> format
  if (raw.ItemCode != null && raw.PromotionDetails) {
    const d = raw.PromotionDetails;
    return {
      PromotionId: Number(raw.PromotionId || raw.PromotionID),
      chainId: BigInt(chainId),
      SubChainId: subChainId,
      StoreId: storeId,

      // pull description & dates from PromotionDetails
      PromotionName: d.PromotionDescription,
      StartDate: d.PromotionStartDate
        ? new Date(`${d.PromotionStartDate}T${d.PromotionStartHour}`)
        : undefined,
      EndDate: d.PromotionEndDate
        ? new Date(`${d.PromotionEndDate}T${d.PromotionEndHour}`)
        : undefined,

      // only one item per <Line> — use ItemCode + DiscountedPrice
      groceryItems: [
        {
          itemCode: BigInt(raw.ItemCode),
          DiscountPrice:
            d.DiscountedPrice != null
              ? parseFloat(d.DiscountedPrice)
              : undefined,
        },
      ],
    };
  }
  // ———————————————————————————————————————————————

  // 𝗢𝗹𝗱 𝗯𝗿𝗮𝗻𝗰𝗵: your existing logic for
  // grouped <Promotions><Promotion>…</Promotion> or
  // flat <Promos><Sale>…</Sale>
  const items = ensureArray(raw.PromotionItems?.Item);

  return {
    PromotionId: Number(raw.PromotionId || raw.PromotionID),
    chainId: BigInt(chainId),
    SubChainId: subChainId,
    StoreId: storeId,
    PromotionName: raw.PromotionDescription || raw.PromotionName,
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
        itemCode: BigInt(it.ItemCode),
        DiscountPrice:
          it.DiscountedPrice != null
            ? parseFloat(it.DiscountedPrice)
            : undefined,
      })
    ),
  };
}
