export interface Store {
  ChainId: string;
  SubChainId: string;
  StoreId: string;
  StoreName: string | null;
  Address: string | null;
  City: string | null;
  StoreType: number | null;
  Latitude: number | null;
  Longitude: number | null;
  subchains: {
    imageUrl: string | null;
    SubChainName: string | null;
  };
}
