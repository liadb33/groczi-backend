export interface Grocery {
  itemCode: number; //primary key
  itemType: number;
  itemName: string;
  manufacturerName: string;
  manufactureCountry: string;
  manufacturerItemDescription: string;
  unitQty: string;
  unitOfMeasure: string;
  isWeighted: boolean;
  qtyInPackage: number;
  unitOfMeasurePrice: number;
  quantity: number;
}

export interface GroceryReference {
  itemCode: number; // references grocery.itemCode
  ChainId: bigint; // references stores(ChainId)
  SubChainId: number; // references stores(SubChainId)
  StoreId: number; // references stores(StoreId)
  itemPrice: number;
  allowDiscount: boolean;
  item: Grocery;
}
