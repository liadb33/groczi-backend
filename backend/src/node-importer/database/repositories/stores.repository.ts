import prisma from "../prismaClient.js";
import { Store } from "../../features/stores/store.entity.js";

export async function saveStore(store: Store) {
  if (!store.ChainId || !store.StoreId) return;
  const chainId = parseInt(store.ChainId);
  const subChainId = store.SubChainId ? parseInt(store.SubChainId) : null;
  const storeId = parseInt(store.StoreId);

  await prisma.chains.upsert({
    where: { ChainId: chainId },
    update: { ChainName: store.ChainName },
    create: { ChainId: chainId, ChainName: store.ChainName },
  });

  if (subChainId !== null) {
    await prisma.subChains.upsert({
      where: { SubChainId: subChainId },
      update: {
        SubChainName: store.SubChainName,
        ChainId: chainId,
      },
      create: {
        SubChainId: subChainId,
        ChainId: chainId,
        SubChainName: store.SubChainName,
      },
    });
  }

  await prisma.stores.upsert({
    where: { StoreId: storeId },
    update: {
      SubChainId: subChainId,
      StoreName: store.StoreName,
      Address: store.Address,
      City: store.City,
      ZipCode: store.ZipCode,
      StoreType: store.StoreType,
    },
    create: {
      StoreId: storeId,
      SubChainId: subChainId,
      StoreName: store.StoreName,
      Address: store.Address,
      City: store.City,
      ZipCode: store.ZipCode,
      StoreType: store.StoreType,
    },
  });
}
