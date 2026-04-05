import type { FastifyInstance } from 'fastify';
import type { Clock } from '../application/ports/Clock.js';
import type { ServerDependencies } from '../application/ServerDependencies.js';
import { AddItemToOrder } from '../application/use-cases/AddItemToOrder.js';
import { CreateOrder } from '../application/use-cases/CreateOrder.js';
import { buildServer } from '../infrastructure/http/server.js';
import { StaticPricingService } from '../infrastructure/http/StaticPricingService.js';
import { NoopEventBus } from '../infrastructure/messaging/NoopEventBus.js';
import { InMemoryOrderRepository } from '../infrastructure/persistence/in-memory/InMemoryOrderRepository.js';

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export type Container = ServerDependencies;

export const buildContainer = (): Container => {
  const orderRepository = new InMemoryOrderRepository();
  const pricingService = new StaticPricingService();
  const eventBus = new NoopEventBus();
  const clock = new SystemClock();

  const createOrder = new CreateOrder(orderRepository, eventBus, clock);
  const addItemToOrder = new AddItemToOrder(
    orderRepository,
    pricingService,
    eventBus,
    clock,
  );

  return {
    createOrder,
    addItemToOrder,
    orderRepository,
  };
};

export const createHttpServer = (): FastifyInstance => {
  const deps = buildContainer();
  return buildServer(deps);
};
