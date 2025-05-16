import { Bookmark, Prisma } from "@prisma/client";
import { StoreGroceryItem } from "./stores.groceries.type.js";

export interface BookmarkWithGrocery extends Bookmark {
  grocery: {
    itemName: string | null;
    manufacturerItemDescription: string | null;
    unitQty: string | null;
    quantity: Prisma.Decimal | null;
    isWeighted: boolean | null;
    qtyInPackage: number | null;
    store_grocery: StoreGroceryItem[] | null;
  };
}
