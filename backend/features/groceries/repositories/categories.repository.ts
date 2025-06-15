import prisma from "../../shared/prisma-client/prisma-client.js";
import { CATEGORIES } from "../../../../parser/constants/categories.js";

/**
 * Get all available categories
 */
export const getAllCategories = async () => {
  return CATEGORIES;
};

/**
 * Get groceries by single category or multiple categories
 */
export const getGroceriesByCategories = async (
  categories: string | string[],
  page: number = 1,
  limit: number = 10
) => {
  const offset = (page - 1) * limit;
  
  // Convert single category to array for uniform handling
  const categoryArray = Array.isArray(categories) ? categories : [categories];

  const [data, total] = await Promise.all([
    prisma.grocery.findMany({
      where: {
        category: {
          in: categoryArray,
        },
      },
      skip: offset,
      take: limit,
    }),
    prisma.grocery.count({
      where: {
        category: {
          in: categoryArray,
        },
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
    categories: categoryArray,
  };
};

/**
 * Get groceries count by category
 */
export const getGroceriesCountByCategory = async (category: string) => {
  return await prisma.grocery.count({
    where: {
      category: category,
    },
  });
}; 