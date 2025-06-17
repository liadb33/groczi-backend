import prisma from "../../shared/prisma-client/prisma-client.js";


// get all groceries with filters
export const getAllGroceries = async (
  minPrice?: number,
  maxPrice?: number,
  company?: string,
  page: number = 1,
  limit: number = 10
) => {
  const offset = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.grocery.findMany({
      where: {
        AND: [
          minPrice !== undefined
            ? { unitOfMeasurePrice: { gte: minPrice } }
            : {},
          maxPrice !== undefined
            ? { unitOfMeasurePrice: { lte: maxPrice } }
            : {},
          company
            ? {
                manufacturerName: {
                  contains: company,
                },
              }
            : {},
        ],
      },
      skip: offset,
      take: limit,
    }),
    prisma.grocery.count({
      where: {
        AND: [
          minPrice !== undefined
            ? { unitOfMeasurePrice: { gte: minPrice } }
            : {},
          maxPrice !== undefined
            ? { unitOfMeasurePrice: { lte: maxPrice } }
            : {},
          company
            ? {
                manufacturerName: {
                  contains: company,
                },
              }
            : {},
        ],
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    page,
    limit,
    total,
    totalPages,
  };
};




export const getGroceryByItemCode = async (itemCode: string) => {
  return await prisma.grocery.findUnique({
    where: { itemCode },
  });
};

export const getGroceryHistory = async (itemCode: string) => {
  return await prisma.store_grocery_price_history.findMany({
    where: { itemCode },
    include: {
      stores: true, // ודא שזה השם הנכון של היחס ב-Prisma schema שלך
    },
    orderBy: [
      { StoreId: 'asc' },
      { updateDatetime: 'asc' },
    ],
  });
};


export const getStoresByItemCode = async (
  itemCode: string,
  page: number = 1,
  limit: number = 10,
  userLatitude?: number,
  userLongitude?: number
) => {
  const offset = (page - 1) * limit;

  // If user coordinates are provided, get all data first (no pagination) to sort by distance
  // then apply pagination manually after sorting
  if (userLatitude !== undefined && userLongitude !== undefined) {
    const [allData, total] = await Promise.all([
      prisma.store_grocery.findMany({
        where: { itemCode },
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
        orderBy: { itemPrice: 'asc' }, // Secondary sort by price
      }),
      prisma.store_grocery.count({
        where: { itemCode },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    
    return {
      data: allData,
      page,
      limit,
      total,
      totalPages,
      userLatitude,
      userLongitude,
    };
  }

  // Original logic for when no user coordinates are provided
  const [data, total] = await Promise.all([
    prisma.store_grocery.findMany({
      where: { itemCode },
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
      skip: offset,
      take: limit,
      orderBy: { itemPrice: 'asc' }, // Order by price to show cheapest first
    }),
    prisma.store_grocery.count({
      where: { itemCode },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    page,
    limit,
    total,
    totalPages,
  };
};


// search groceries
export const searchGroceries = async (
  query: string,
  page: number = 1,
  limit: number = 20
) => {
  // 1. Find items that start with the query (for both name and code)
  const startsWithResults = await prisma.grocery.findMany({
    where: {
      OR: [
        { itemName: { startsWith: query, not: null } },
        { itemCode: { startsWith: query, not: undefined } },
      ],
    },
  });

  // 2. Find items that contain the query, but exclude the ones already found
  const containsResults = await prisma.grocery.findMany({
    where: {
      OR: [
        { itemName: { contains: query, not: null } },
        { itemCode: { contains: query, not: undefined } },
      ],
      AND: [
        {
          itemCode: {
            // assuming you have a unique "id" field
            notIn: startsWithResults.map((item) => item.itemCode),
          },
        },
      ],
    },
  });

  // 3. Merge results: startsWith first, then contains
  const mergedResults = [...startsWithResults, ...containsResults];

  // 4. Apply pagination
  const pagedResults = mergedResults.slice((page - 1) * limit, page * limit);

  return pagedResults;
};



export const countGroceries = async (query: string) => {
  return await prisma.grocery.count({
    where: {
      itemName: {
        startsWith: query,
        not: null,
      },
    },
  });
};

