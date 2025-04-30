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
  itemCode: number; //references the itemCode to grocery table
  StoreId: number; //references the storeId to stores table
  itemPrice: number;
  allowDiscount: boolean;
  item: Grocery;
}
