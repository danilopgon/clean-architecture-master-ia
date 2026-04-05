import type { OrderRepository } from './ports/OrderRepository.js';
import type { AddItemToOrder } from './use-cases/AddItemToOrder.js';
import type { CreateOrder } from './use-cases/CreateOrder.js';

export type ServerDependencies = {
  readonly createOrder: CreateOrder;
  readonly addItemToOrder: AddItemToOrder;
  readonly orderRepository: OrderRepository;
};
