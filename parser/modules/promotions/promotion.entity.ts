export interface Promotion {
  chainId: bigint;
  SubChainId: number;
  StoreId: number;
  PromotionId: number;
  PromotionName?: string;
  StartDate?: Date;
  EndDate?: Date;
  groceryItems: GroceryItem[];
}

export interface GroceryItem {
  itemCode: bigint;
  DiscountPrice?: number;
}
