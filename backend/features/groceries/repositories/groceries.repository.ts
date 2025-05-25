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
  return await prisma.grocery.findMany({
    where: {
      itemName: {
        startsWith: query,
        not: null,
      },
    },
    skip: (page - 1) * limit,
    take: limit,
  });
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

