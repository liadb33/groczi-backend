export interface GroceryItem {
  itemCode: string;
  itemType: number;
  itemName: string;
  manufacturerName: string;
  manufactureCountry: string;
  manufacturerItemDescription: string;
  unitQty: string;
  quantity: number;
  unitOfMeasure: string;
  isWeighted: boolean;
  qtyInPackage: number;
  itemPrice: number;
  unitOfMeasurePrice: number;
  allowDiscount: boolean;
  itemStatus: number;
  itemId: number;
}

export interface GroceryData {
  chainId: number;
  subChainId: number;
  storeId: number;
  items: GroceryItem[];
}
