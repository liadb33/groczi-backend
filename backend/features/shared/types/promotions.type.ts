export interface Promotion {
  PromotionId: string;
  ChainId: string;
  SubChainId: string;
  StoreId: string;
  PromotionName?: string;
  StartDate?: Date;
  EndDate?: Date;
}
