import prisma from "../prisma-client/prismaClient.js";
import { Store } from "../modules/stores/store.entity.js";

export async function findStoreByChainIdAndStoreId(
  chainId: string,
  storeId: string
): Promise<{ SubChainId: string } | null> {
  return prisma.stores.findFirst({
    where: { ChainId: chainId, StoreId: storeId },
    select: { SubChainId: true },
  });
}

export async function saveStore(store: Store) {
  const {
    ChainId,
    ChainName,
    SubChainId,
    SubChainName,
    StoreId,
    StoreName,
    Address,
    City,
    ZipCode,
    StoreType,
    Latitude,
    Longitude,
  } = store;

  // 1. Upsert chains (PK: ChainId)
  await prisma.chains.upsert({
    where: { ChainId },
    update: { ChainName },
    create: { ChainId, ChainName },
  });

  // 2. Upsert subchains (Composite PK: ChainId + SubChainId)
  await prisma.subchains.upsert({
    where: {
      ChainId_SubChainId: {
        ChainId,
        SubChainId,
      },
    },
    update: { SubChainName },
    create: {
      ChainId,
      SubChainId,
      SubChainName,
    },
  });

  // 3. Upsert stores (Composite PK: ChainId + SubChainId + StoreId)
  await prisma.stores.upsert({
    where: {
      ChainId_SubChainId_StoreId: {
        ChainId,
        SubChainId,
        StoreId,
      },
    },
    update: {
      StoreName,
      Address,
      City,
      ZipCode,
      StoreType,
      Latitude,
      Longitude,
    },
    create: {
      ChainId,
      SubChainId,
      StoreId,
      StoreName,
      Address,
      City,
      ZipCode,
      StoreType,
      Latitude,
      Longitude,
    },
  });
}
export async function findStoreByIds(ids: {
  ChainId: string;
  SubChainId: string;
  StoreId: string;
}): Promise<{
  StoreName: string | null;
  Address: string | null;
  City: string | null;
  ZipCode: string | null;
} | null> {
  return await prisma.stores.findFirst({
    where: {
      ChainId: ids.ChainId,
      SubChainId: ids.SubChainId,
      StoreId: ids.StoreId,
    },
    select: {
      StoreName: true,
      Address: true,
      City: true,
      ZipCode: true,
    },
  });
}

export async function getSubchainsByChainId(chainId: string): Promise<
  {
    SubChainId: string;
  }[]
> {
  return await prisma.subchains.findMany({
    where: { ChainId: chainId },
    select: {
      SubChainId: true,
    },
  });
}
