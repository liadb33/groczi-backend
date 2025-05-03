import path from "path";
import { XMLParser } from "fast-xml-parser";
import { Promotion, GroceryItem } from "./promotion.entity.js";
import { readFileWithEncoding } from "../../utils/encoding.utils.js";
import { findStoreByChainIdAndStoreId } from "../stores/stores.repository.js";

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
  const match = fileName.match(/PromoFull(\d+)-(\d+)-/);
  if (match) {
    return { chainId: Number(match[1]), storeId: Number(match[2]) };
  }
  return { chainId: 0, storeId: 0 };
}

function mapPromotion(
  raw: any,
  chainId: number,
  subChainId: number,
  storeId: number
): Promotion {
  return {
    PromotionId: Number(raw.PromotionId || raw.PromotionID),
    ChainId: chainId,
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
    groceryItems: (Array.isArray(raw.PromotionItems?.Item)
      ? raw.PromotionItems.Item
      : raw.PromotionItems?.Item
      ? [raw.PromotionItems.Item]
      : []
    ).map(
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

  // בודקים אם המזהים קיימים ב-XML
  const root = json.Root ?? json.root ?? json.OrderXml?.Envelope ?? {};
  const xmlChain = Number(root.ChainId ?? root.ChainID ?? 0);
  const xmlSub = Number(root.SubChainId ?? root.SubChainID ?? 0);
  const xmlStore = Number(root.StoreId ?? 0);

  // אם לא קיים ב-XML, נחלץ מהקובץ
  const { chainId: fileChain, storeId: fileStore } =
    extractIdsFromFilename(filePath);
  const chainId = xmlChain || fileChain;
  const storeId = xmlStore || fileStore;
  if (!chainId || !storeId) return [];

  // subChain: אם לא ב-XML, מוציאים מה-DB
  const storeRecord = await findStoreByChainIdAndStoreId(chainId, storeId);
  if (!storeRecord) {
    console.error(
      `Store not found in DB for ChainId: ${chainId}, StoreId: ${storeId}`
    );
    return [];
  }
  const subChainId = storeRecord.SubChainId;
  if (!subChainId) return [];

  // שליפת שורות ההזמנה (OrderXml)
  const orderLines = json.OrderXml?.Envelope?.Header?.Details?.Line;
  if (orderLines) {
    const arr = Array.isArray(orderLines) ? orderLines : [orderLines];
    return arr.map((line) => mapPromotion(line, chainId, subChainId, storeId));
  }

  // פורמט grouped
  const grouped = root.Promotions?.Promotion || json.Promotions?.Promotion;
  if (grouped) {
    const arr = Array.isArray(grouped) ? grouped : [grouped];
    return arr.map((raw) => mapPromotion(raw, chainId, subChainId, storeId));
  }

  // פורמט flat
  const sales =
    root.Promos?.Sale || json.Promos?.Sales?.Sale || json.Promos?.Sale;
  if (sales) {
    const arr = Array.isArray(sales) ? sales : [sales];
    return arr.map((raw) => mapPromotion(raw, chainId, subChainId, storeId));
  }

  return [];
}
