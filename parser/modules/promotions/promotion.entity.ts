export interface Promotion {
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