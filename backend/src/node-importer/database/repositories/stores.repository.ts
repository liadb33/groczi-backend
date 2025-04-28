import prisma from "../prismaClient.js";
import { StoreType } from "../../features/stores/store.entity.js";

export async function saveStore(store: StoreType) {
  if (!store.ChainId || !store.StoreId) return;
  const chainId = parseInt(store.ChainId);
  const subChainId = store.SubChainId ? parseInt(store.SubChainId) : null;
  const storeId = parseInt(store.StoreId);

  await prisma.chains.upsert({
    where: { ChainId: chainId },
    update: { ChainName: store.ChainName || undefined },
    create: { ChainId: chainId, ChainName: store.ChainName || "" },
  });

  if (subChainId !== null) {
    await prisma.subChains.upsert({
      where: { SubChainId: subChainId },
      update: {
        SubChainName: String(store.SubChainName) || undefined,
        ChainId: chainId,
      },
      create: {
        SubChainId: subChainId,
        ChainId: chainId,
        SubChainName: String(store.SubChainName) || "",
      },
    });
  }

  await prisma.stores.upsert({
    where: { StoreId: storeId },
    update: {
      SubChainId: subChainId ?? undefined,
      StoreName: store.StoreName || undefined,
      Address: store.Address || undefined,
      City: String(store.City) || undefined,
      ZipCode: String(store.ZipCode) || undefined,
      StoreType: store.StoreType ? parseInt(store.StoreType) : undefined,
    },
    create: {
      StoreId: storeId,
      SubChainId: subChainId ?? undefined,
      StoreName: store.StoreName || "",
      Address: store.Address || "",
      City: String(store.City) || "",
      ZipCode: String(store.ZipCode) || "",
      StoreType: store.StoreType ? parseInt(store.StoreType) : undefined,
    },
  });
}
