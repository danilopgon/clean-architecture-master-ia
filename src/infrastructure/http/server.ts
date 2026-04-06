import fastify, { type FastifyInstance } from 'fastify';
import type { ServerDependencies } from '../../application/ServerDependencies.js';
import { OrdersController } from './controllers/OrdersControllers.js';

export const buildServer = (deps: ServerDependencies): FastifyInstance => {
  const app = fastify({ logger: true });
  const logger = deps.logger.child({ context: 'http-server' });

  const ordersController = new OrdersController(deps);
  ordersController.registerRoutes(app);

  app.addHook('onReady', async () => {
    logger.info('HTTP server initialized');
  });

  app.get('/health', async () => {
    logger.info('Health check requested');
    return { status: 'ok' };
  });

  return app;
};
