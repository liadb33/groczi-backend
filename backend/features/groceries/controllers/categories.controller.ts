import { Request, Response, NextFunction } from 'express';
import { 
  getAllCategories, 
  getGroceriesByCategories, 
  getGroceriesCountByCategory 
} from '../repositories/categories.repository.js';

/**
 * Controller to get all available categories
 */
export const getAllCategoriesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await getAllCategories();
    res.json({
      success: true,
      data: categories,
      total: categories.length
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    next(error);
  }
};

/**
 * Controller to get groceries by category/categories
 * Supports both single category and multiple categories
 * Query params:
 * - category: single category name or pipe-separated category names
 * - page: page number (default: 1)
 * - limit: items per page (default: 10)
 */
export const getGroceriesByCategoriesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryParam = req.query.category as string;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    if (!categoryParam) {
      return res.status(400).json({
        success: false,
        message: "Category parameter is required"
      });
    }

    // Handle pipe-separated categories (using | instead of , to avoid conflicts with category names containing commas)
    const categories = categoryParam.includes('|') 
      ? categoryParam.split('|').map(cat => cat.trim())
      : categoryParam;

    const result = await getGroceriesByCategories(categories, page, limit);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Error fetching groceries by categories:", error);
    next(error);
  }
};

/**
 * Controller to get groceries count for a specific category
 */
export const getGroceriesCountByCategoryController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category } = req.params;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category parameter is required"
      });
    }

    const count = await getGroceriesCountByCategory(category);
    
    res.json({
      success: true,
      category,
      count
    });
  } catch (error) {
    console.error("Error getting groceries count by category:", error);
    next(error);
  }
}; 