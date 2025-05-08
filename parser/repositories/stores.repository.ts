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
    },
  });
}
