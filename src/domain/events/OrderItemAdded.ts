import type { DomainEvent } from './DomainEvent.js';
import type { OrderId } from '../value-objects/OrderId.js';
import type { SKU } from '../value-objects/SKU.js';
import type { Money } from '../value-objects/Money.js';
import type { Quantity } from '../value-objects/Quantity.js';

export class OrderItemAdded implements DomainEvent {
  readonly name = 'OrderItemAdded';

  constructor(
    readonly aggregateId: string,
    readonly orderId: OrderId,
    readonly sku: SKU,
    readonly unitPrice: Money,
    readonly quantity: Quantity,
    readonly occurredAt: Date,
  ) {}
}
