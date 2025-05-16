import { Prisma } from "@prisma/client";

export interface StoresGroceries {
  itemCode: string;
  ChainId: string;
  SubChainId: string;
  StoreId: string;
  itemPrice?: number;
  allowDiscount?: boolean;
}

export interface StoreGroceryItem {
  itemPrice: Prisma.Decimal | null;
}
