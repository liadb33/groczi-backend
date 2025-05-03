import { GetGroceriesQuery, GroceryItem } from '../groceries.schema';

// Mock Database Simulation
const MOCK_GROCERIES: GroceryItem[] = Array.from({ length: 55 }, (_, i) => ({
  id: `item-${i + 1}`,
  name: `Product ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
  category: i % 5 === 0 ? 'Dairy' : i % 5 === 1 ? 'Produce' : i % 5 === 2 ? 'Bakery' : i % 5 === 3 ? 'Meat' : 'Pantry',
  weight: `${(i % 10) * 100 + 100}g`,
  basePrice: parseFloat((1.5 + Math.random() * 10 + (i % 7)).toFixed(2)),
  imageUrl: `https://via.placeholder.com/150/0000FF/808080?text=Product+${i + 1}`,
  company: i % 3 === 0 ? 'Farm Fresh Co.' : i % 3 === 1 ? 'Good Grocer' : 'MegaMart',
  isBookmarked: i % 7 === 0, // Simulate some being bookmarked
}));

export class GroceryService {
  async findGroceries(query: GetGroceriesQuery): Promise<{
    data: GroceryItem[];
    pagination: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      itemsPerPage: number;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      minPrice,
      maxPrice,
      company,
      sortBy = 'name',
      sortOrder = 'asc',
      // latitude, longitude // Not used in mock
    } = query;

    let filteredGroceries = [...MOCK_GROCERIES];

    // Filtering
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredGroceries = filteredGroceries.filter(item =>
        item.name.toLowerCase().includes(searchTerm)
      );
    }
    if (category) {
      filteredGroceries = filteredGroceries.filter(item => item.category === category);
    }
    if (minPrice !== undefined) {
      filteredGroceries = filteredGroceries.filter(item => item.basePrice >= minPrice);
    }
    if (maxPrice !== undefined) {
      filteredGroceries = filteredGroceries.filter(item => item.basePrice <= maxPrice);
    }
    if (company) {
      filteredGroceries = filteredGroceries.filter(item => item.company === company);
    }

    // Sorting
    filteredGroceries.sort((a, b) => {
      const valA = a[sortBy as keyof GroceryItem]; // Type assertion needed for dynamic key
      const valB = b[sortBy as keyof GroceryItem];

      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return sortOrder === 'desc' ? comparison * -1 : comparison;
    });

    // Pagination
    const totalItems = filteredGroceries.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredGroceries.slice(startIndex, endIndex);

    // Simulate async operation (like DB query)
    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      data: paginatedData,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
      },
    };
  }

  // Placeholder for other methods like findById, create, update, delete...
} 