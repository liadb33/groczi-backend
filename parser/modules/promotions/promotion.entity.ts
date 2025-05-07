export interface Promotion {
  ChainId: string;
  SubChainId: string;
  StoreId: string;
  PromotionId: string;
  PromotionName?: string;
  StartDate?: Date;
  EndDate?: Date;
  groceryItems: GroceryItem[];
}

export interface GroceryItem {
  itemCode: string;
  DiscountPrice?: number;
}
