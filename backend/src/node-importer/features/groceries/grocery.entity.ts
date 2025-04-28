export interface Grocery {
  itemCode: string; //primary key
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
  itemCode: string; //references the itemCode to grocery table
  storeId: number; //references the storeId to stores table
  itemPrice: number;
  allowDiscount: boolean;
  items: Grocery[];
}
