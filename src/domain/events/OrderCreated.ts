import type { DomainEvent } from './DomainEvent.js';
import type { OrderId } from '../value-objects/OrderId.js';

export class OrderCreated implements DomainEvent {
  readonly name = 'OrderCreated';

  constructor(
    readonly aggregateId: string,
    readonly orderId: OrderId,
    readonly occurredAt: Date,
  ) {}
}
