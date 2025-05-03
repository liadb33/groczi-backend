import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { GetGroceriesQuerySchema, GetGroceriesResponseSchema } from '../groceries.schema';
import { GroceryController } from '../controllers/groceries.controller';

// Define routes for the groceries feature
async function groceryRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  const groceryController = new GroceryController();

  // GET /groceries route definition
  fastify.route({
    method: 'GET',
    url: '/', // Base path will be prefixed by register
    schema: {
      tags: ['Groceries'], // For documentation generation
      description: 'Fetch a list of groceries with filtering, sorting, and pagination.',
      querystring: GetGroceriesQuerySchema,
      response: {
        200: GetGroceriesResponseSchema,
        // Define other potential responses (e.g., 400 Bad Request, 500 Internal Server Error)
        // Fastify/sensible handles some common errors automatically
      },
    },
    handler: groceryController.getGroceries.bind(groceryController), // Bind `this` context
  });

  // Add other grocery routes here (e.g., GET /:id, POST /, PUT /:id, DELETE /:id)
}

// Export as a Fastify plugin
export default fp(groceryRoutes); 