export interface Store {
  ChainId?: bigint;
  SubChainId: number;
  StoreId: number;
  StoreName: string;
  Address: string;
  City?: string;
  ZipCode: string;
  StoreType?: number;
  ChainName?: string;
  SubChainName?: string;
}
