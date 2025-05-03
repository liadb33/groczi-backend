import { Type, Static } from '@sinclair/typebox';

// Reusable Grocery Item Schema
const GroceryItemSchema = Type.Object({
  id: Type.String(), // Assuming UUID or similar string ID
  name: Type.String(),
  category: Type.String(), // Could be an Enum later
  weight: Type.Optional(Type.String()), // e.g., "1kg", "500g", "1 unit"
  basePrice: Type.Number({ minimum: 0 }),
  imageUrl: Type.Optional(Type.String({ format: 'uri' })),
  company: Type.Optional(Type.String()),
  isBookmarked: Type.Boolean(), // Assuming we know this contextually
});

// Schema for Query Parameters
export const GetGroceriesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
  search: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()), // Consider Enum later
  minPrice: Type.Optional(Type.Number({ minimum: 0 })),
  maxPrice: Type.Optional(Type.Number({ minimum: 0 })),
  company: Type.Optional(Type.String()),
  sortBy: Type.Optional(Type.Enum( // Define possible sort fields
    { name: 'name', price: 'basePrice', category: 'category' },
    { default: 'name' }
  )),
  sortOrder: Type.Optional(Type.Enum(
    { asc: 'asc', desc: 'desc' },
    { default: 'asc' }
  )),
  // Optional location for store distance filtering (if implemented later)
  latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
  longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
});

// Schema for the Response Body
export const GetGroceriesResponseSchema = Type.Object({
  data: Type.Array(GroceryItemSchema),
  pagination: Type.Object({
    totalItems: Type.Integer(),
    totalPages: Type.Integer(),
    currentPage: Type.Integer(),
    itemsPerPage: Type.Integer(),
  }),
});

// Static types for TypeScript inference
export type GetGroceriesQuery = Static<typeof GetGroceriesQuerySchema>;
export type GroceryItem = Static<typeof GroceryItemSchema>; 