import { randomUUID } from 'node:crypto';
import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';
import type { AppError } from '../errors.js';
import { infraError, mapDomainErrorToAppError } from '../errors.js';
import type { OrderRepository } from '../ports/OrderRepository.js';
import type { EventBus } from '../ports/EventBus.js';
import type { Clock } from '../ports/Clock.js';
import type { CreateOrderDTO } from '../dtos/CreateOrderDTO.js';
import { OrderId } from '../../domain/value-objects/OrderId.js';
import { Order } from '../../domain/entities/Order.js';

export type CreateOrderOutput = {
  orderId: string;
};

export class CreateOrder {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
  ) {}

  async execute(_dto: CreateOrderDTO): Promise<Result<CreateOrderOutput, AppError>> {
    const orderIdResult = OrderId.create(randomUUID());
    if (!orderIdResult.ok) {
      return fail(mapDomainErrorToAppError(orderIdResult.error));
    }

    const now = this.clock.now();
    const order = Order.create(orderIdResult.value, now);

    const saveResult = await this.orderRepository.save(order);
    if (!saveResult.ok) {
      return fail(saveResult.error);
    }

    const events = order.pullEvents();
    if (events.length > 0) {
      const publishResult = await this.eventBus.publish(events);
      if (!publishResult.ok) {
        return fail(infraError('Order was saved but event publication failed', publishResult.error));
      }
    }

    return ok({ orderId: order.id.value });
  }
}