import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import groceryRoutes from './features/groceries/routes/groceries.routes';
// Import other feature routes here as they are created

// Instantiate Fastify
const server = Fastify({
  logger: true, // Enable logging (options: true, false, { level: 'info' })
});

async function main() {
  // Register sensible plugin (adds sensible defaults and utilities)
  await server.register(sensible);

  // Register feature route plugins
  // Prefix all grocery routes with /api/v1/groceries
  await server.register(groceryRoutes, { prefix: '/api/v1/groceries' });

  // Register other feature routes with their prefixes
  // await server.register(storeRoutes, { prefix: '/api/v1/stores' });
  // ... etc.

  // Basic root route
  server.get('/', async (request, reply) => {
    return { message: 'Groczi API is running!' };
  });

  // Start the server
  try {
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    await server.listen({ port: PORT, host: HOST });

    server.log.info(`Server listening at http://${HOST}:${PORT}`);
    server.log.info(`API documentation might be available at /documentation if swagger is setup`); // Placeholder info

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main(); 