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


export const getStoresByItemCode = async (itemCode: string) => {
  return await prisma.store_grocery.findMany({
    where: { itemCode },
    include: {
      stores: true, // This pulls the full store data
    },
  });
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

