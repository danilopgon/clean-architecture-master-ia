import type { DomainEvent } from './DomainEvent.js';
import type { OrderId } from '../value-objects/OrderId.js';
import type { Money } from '../value-objects/Money.js';

export class OrderPlaced implements DomainEvent {
  readonly name = 'OrderPlaced';

  constructor(
    readonly aggregateId: string,
    readonly orderId: OrderId,
    readonly totals: ReadonlyMap<string, Money>,
    readonly occurredAt: Date,
  ) {}
}
