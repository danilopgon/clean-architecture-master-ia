import fastify, { type FastifyInstance } from 'fastify';
import type { ServerDependencies } from '../../application/ServerDependencies.js';
import { OrdersController } from './controllers/OrdersControllers.js';

export const buildServer = (deps: ServerDependencies): FastifyInstance => {
  const app = fastify({ logger: true });
  const ordersController = new OrdersController(deps);
  ordersController.registerRoutes(app);

  app.get('/health', async (request) => {
    request.log.info('Health check requested');
    return { status: 'ok' };
  });

  return app;
};
