import type { FastifyInstance } from 'fastify';
import type { EventBus } from '../application/ports/EventBus.js';
import type { Clock } from '../application/ports/Clock.js';
import type { ServerDependencies } from '../application/ServerDependencies.js';
import { AddItemToOrder } from '../application/use-cases/AddItemToOrder.js';
import { CreateOrder } from '../application/use-cases/CreateOrder.js';
import { config } from './config.js';
import { buildServer } from '../infrastructure/http/server.js';
import { StaticPricingService } from '../infrastructure/http/StaticPricingService.js';
import { PinoLogger } from '../infrastructure/logging/PinoLogger.js';
import { createMessaging } from '../infrastructure/messaging/MessagingFactory.js';
import { InMemoryOrderRepository } from '../infrastructure/persistence/in-memory/InMemoryOrderRepository.js';
import { PostgresOrderRepository } from '../infrastructure/persistence/postgres/PostgresOrderRepository.js';

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export type Container = ServerDependencies & {
  shutdown: () => Promise<void>;
};

export const buildContainer = (): Container => {
  const useInMemory = config.USER_INMEMORY;
  let orderRepository: InMemoryOrderRepository | PostgresOrderRepository;
  let eventBus: EventBus;

  const logger = new PinoLogger({
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    name: 'clean-architecture-api',
    prettyPrint: config.NODE_ENV !== 'production',
  });

  const messaging = createMessaging({
    useInMemory,
    databaseUrl: config.DATABASE_URL ?? '',
    logger,
  });

  if (useInMemory) {
    orderRepository = new InMemoryOrderRepository();
    eventBus = messaging.eventBus;
  } else {
    if (messaging.pool === null) {
      throw new Error('Messaging factory did not return a PostgreSQL pool in persistent mode.');
    }

    orderRepository = new PostgresOrderRepository(messaging.pool);
    eventBus = messaging.eventBus;
  }

  const pricingService = new StaticPricingService();
  const clock = new SystemClock();
  const createOrder = new CreateOrder(orderRepository, eventBus, clock);
  const addItemToOrder = new AddItemToOrder(
    orderRepository,
    pricingService,
    eventBus,
    clock,
  );

  const shutdown = async (): Promise<void> => {
    if (messaging.outboxDispatcher !== null) {
      logger.info('Stopping outbox dispatcher');
    }
    if (messaging.pool !== null) {
      logger.info('Closing database pool');
      await messaging.pool.end();
    }
  };

  return {
    createOrder,
    addItemToOrder,
    orderRepository,
    logger,
    shutdown,
  };
};

export const createHttpServer = (): FastifyInstance => {
  const deps = buildContainer();
  return buildServer(deps);
};
