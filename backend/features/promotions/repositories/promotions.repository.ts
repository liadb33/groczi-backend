import prisma from "../../shared/prisma-client/prisma-client.js";


// get all promotions
export const getAllPromotions = async () => {
  return await prisma.promotion.findMany();
};

// get promotion by id
export const getDiscountedGroceriesByPromotionId = async (
  promotionId: string,
  chainId: string,
  subChainId: string,
  storeId: string
) => {
  return await prisma.promotion.findUnique({
    where: {
      PromotionId_ChainId_SubChainId_StoreId: {
        PromotionId: promotionId,
        ChainId: chainId,
        SubChainId: subChainId,
        StoreId: storeId,
      },
    },
    include: {
      promotion_grocery: {
        include: {
          grocery: true,
        },
      },
    },
  });
};


// get promotions by store
export const getPromotionsByStore = async (
  chainId: string,
  subChainId: string,
  storeId: string
) => {
  return await prisma.promotion.findMany({
    where: {
      ChainId: chainId,
      SubChainId: subChainId,
      StoreId: storeId,
    },
    include: {
      promotion_grocery: true, // optional: include groceries in the promo
    },
  });
};

// get promotions by grocery item code
export const getPromotionsByGroceryItemCode = async (itemCode: string) => {
  return await prisma.promotion_grocery.findMany({
    where: { itemCode },
    include: {
      promotion: true,
    },
  });
};

// Haversine distance formula to calculate distance between two points on Earth
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

export const getPromotionsGroupedByStore = async (
  userLat?: number,
  userLon?: number,
  maxStoreDistance?: number
) => {
  // Fetch all promotions including store info and subchain info
  const promos = await prisma.promotion.findMany({
    include: {
      stores: {
        include: {
          subchains: {
            select: {
              imageUrl: true,
              SubChainName: true
            }
          }
        }
      }
    },
  });

  // Group promotions by store key (chainId-subChainId-storeId)
  const grouped = promos.reduce((acc: any, promo: any) => {
    const key = `${promo.ChainId}-${promo.SubChainId}-${promo.StoreId}`;
    if (!acc[key]) {
      acc[key] = {
        chainId: promo.ChainId,
        subChainId: promo.SubChainId,
        storeId: promo.StoreId,
        storeName: promo.stores?.StoreName || null,
        address: promo.stores?.Address || null,
        city: promo.stores?.City || null,
        latitude: promo.stores?.Latitude || null,
        longitude: promo.stores?.Longitude || null,
        subchains: {
          imageUrl: promo.stores?.subchains?.imageUrl || null,
          SubChainName: promo.stores?.subchains?.SubChainName || null
        },
        promotions: [],
      };
    }
    acc[key].promotions.push({
      promotionId: promo.PromotionId,
      promotionName: promo.PromotionName,
      startDate: promo.StartDate,
      endDate: promo.EndDate,
    });
    return acc;
  }, {});

  // Convert to array
  let storesWithPromotions = Object.values(grouped);

  // If user coordinates are provided, filter and sort by distance
  if (userLat !== undefined && userLon !== undefined) {
    // Filter out stores without coordinates
    storesWithPromotions = storesWithPromotions.filter((store: any) => 
      store.latitude !== null && store.longitude !== null
    );

    // Calculate distance for each store and add it to the store object
    storesWithPromotions = storesWithPromotions.map((store: any) => ({
      ...store,
      distance: calculateDistance(userLat, userLon, store.latitude, store.longitude)
    }));

    // Filter stores within maxStoreDistance if provided
    if (maxStoreDistance !== undefined) {
      storesWithPromotions = storesWithPromotions.filter((store: any) => 
        store.distance <= maxStoreDistance
      );
    }

    // Sort by distance (closest first)
    storesWithPromotions.sort((a: any, b: any) => a.distance - b.distance);
  }

  // Return up to 5 stores
  return storesWithPromotions.slice(0, 5);
};
