export interface Store {
  ChainId: string;
  SubChainId: string;
  StoreId: string;
  StoreName?: string | null;
  Address?: string | null;
  City?: string | null;
  ZipCode?: string | null;
  StoreType?: number;
  ChainName?: string;
  SubChainName?: string;
  Lat?: number | null;
  Lon?: number | null;
}
