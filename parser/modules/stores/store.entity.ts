export interface Store {
  ChainId: string;
  SubChainId: string;
  StoreId: string;
  StoreName?: string;
  Address?: string;
  City: string | null;
  ZipCode: string | null;
  StoreType?: number;
  ChainName?: string;
  SubChainName?: string;
  Lat?: number;
  Lon?: number;
}
