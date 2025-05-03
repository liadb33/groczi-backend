import { FastifyRequest, FastifyReply } from 'fastify';
import { GroceryService } from '../services/groceries.service';
import { GetGroceriesQuery } from '../groceries.schema';

export class GroceryController {
  private groceryService = new GroceryService();

  // Handler for GET /groceries
  async getGroceries(request: FastifyRequest<{ Querystring: GetGroceriesQuery }>, reply: FastifyReply) {
    try {
      // request.query already validated by Fastify based on schema
      const query = request.query;
      const result = await this.groceryService.findGroceries(query);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Error fetching groceries');
      // Using @fastify/sensible will handle this more gracefully, but added explicit handling for clarity
      reply.status(500).send({ message: 'Internal Server Error' });
    }
  }

  // Placeholder for other controller methods...
} 