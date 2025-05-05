import path from "path";
import { XMLParser } from "fast-xml-parser";
import { Promotion, GroceryItem } from "./promotion.entity.js";
import { readFileWithEncoding } from "../../utils/encoding.utils.js";
import { findStoreByChainIdAndStoreId } from "../stores/stores.repository.js";
import { log } from "console";

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (_name: string, jpath: string) => {
    const p = jpath.toLowerCase();
    return (
      p.endsWith("root.promotions.promotion") ||
      p.endsWith("promotions.promotion") ||
      p.endsWith("root.promos.sale") ||
      p.endsWith("promos.sale") ||
      p.endsWith("promos.sales.sale") ||
      p.endsWith("orderxml.envelope.header.details.line") ||
      p.endsWith("promotionitems.item")
    );
  },
});

function extractIdsFromFilename(filePath: string): {
  chainId: number;
  storeId: number;
} {
  const fileName = path.basename(filePath);
  const match = fileName.match(/^promo(?:full)?(\d+)-(\d+)-/i);
  if (match) return { chainId: Number(match[1]), storeId: Number(match[2]) };

  return { chainId: 0, storeId: 0 };
}

function mapPromotion(
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
  const items = Array.isArray(raw.PromotionItems?.Item)
    ? raw.PromotionItems.Item
    : raw.PromotionItems?.Item
    ? [raw.PromotionItems.Item]
    : [];

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

export async function parsePromotionXmlFile(
  filePath: string
): Promise<Promotion[]> {
  const xml = await readFileWithEncoding(filePath);
  const text = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const json = parser.parse(text);
  if (!json) return [];
  const root =
    json.Root ??
    json.root ??
    json.OrderXml?.Envelope ??
    json.Promos ??
    json.promos ??
    {};
  const xmlChain = Number(root.ChainId ?? root.ChainID ?? null);
  const xmlSub = Number(root.SubChainId ?? root.SubChainID ?? null);
  const xmlStore = Number(root.StoreId ?? root.StoreID ?? null);

  const { chainId: fileChain, storeId: fileStore } =
    extractIdsFromFilename(filePath);

  const chainId = xmlChain || fileChain;
  const storeId = xmlStore || fileStore;
  if (!chainId || !storeId) return [];
  let subChainId = xmlSub;
  if (subChainId == null) {
    const storeRecord = await findStoreByChainIdAndStoreId(chainId, storeId);
    if (!storeRecord) return [];
    subChainId = storeRecord.SubChainId;
  }

  const orderLines = json.OrderXml?.Envelope?.Header?.Details?.Line;
  if (orderLines) {
    const arr = Array.isArray(orderLines) ? orderLines : [orderLines];
    return arr.map((line) => mapPromotion(line, chainId, subChainId, storeId));
  }

  const grouped = root.Promotions?.Promotion || json.Promotions?.Promotion;
  if (grouped) {
    const arr = Array.isArray(grouped) ? grouped : [grouped];
    return arr.map((raw) => mapPromotion(raw, chainId, subChainId, storeId));
  }

  const sales =
    root.Promos?.Sale || json.Promos?.Sales?.Sale || json.Promos?.Sale;
  if (sales) {
    const arr = Array.isArray(sales) ? sales : [sales];
    return arr.map((raw) => mapPromotion(raw, chainId, subChainId, storeId));
  }

  return [];
}
