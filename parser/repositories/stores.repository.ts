import prisma from "../database/prismaClient.js";
import { Store } from "../modules/stores/store.entity.js";

export async function saveStore(store: Store) {
  if (!store.ChainId || !store.StoreId) return;

  await prisma.chains.upsert({
    where: { ChainId: store.ChainId },
    update: { ChainName: store.ChainName },
    create: { ChainId: store.ChainId, ChainName: store.ChainName },
  });

  await prisma.subchains.upsert({
    where: { SubChainId: store.SubChainId },
    update: {
      SubChainName: store.SubChainName,
      ChainId: store.ChainId,
    },
    create: {
      SubChainId: store.SubChainId,
      ChainId: store.ChainId,
      SubChainName: store.SubChainName,
    },
  });

  await prisma.stores.upsert({
    where: { StoreId: store.StoreId },
    update: {
      SubChainId: store.SubChainId,
      StoreName: store.StoreName,
      Address: store.Address,
      City: store.City,
      ZipCode: store.ZipCode,
      StoreType: store.StoreType,
    },
    create: {
      StoreId: store.StoreId,
      SubChainId: store.SubChainId,
      StoreName: store.StoreName,
      Address: store.Address,
      City: store.City,
      ZipCode: store.ZipCode,
      StoreType: store.StoreType,
    },
  });
}
