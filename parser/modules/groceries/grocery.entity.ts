export interface Grocery {
  itemCode: string; // primary key
  itemType?: number;
  itemName?: string;
  manufacturerName?: string;
  unitQty?: string;
  unitOfMeasure?: string;
  isWeighted?: boolean;
  qtyInPackage?: number;
  unitOfMeasurePrice?: number;
  quantity?: number;
}

export interface GroceryPriceUpdate {
  ChainId: string; // references stores(ChainId)
  SubChainId: string; // references stores(SubChainId)
  StoreId: string; // references stores(StoreId)
  itemCode: string; // references grocery.itemCode
  itemPrice: number;
  date?: Date;
}

export interface GroceryReference {
  itemCode: string; // references grocery.itemCode
  ChainId: string; // references stores(ChainId)
  SubChainId: string; // references stores(SubChainId)
  StoreId: string; // references stores(StoreId)
  itemPrice?: number;
  allowDiscount?: boolean;
  item: Grocery;
  priceUpdate: GroceryPriceUpdate;
}
