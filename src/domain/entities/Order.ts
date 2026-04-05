import type { DomainError } from '../errors/DomainError.js';
import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';
import type { OrderId } from '../value-objects/OrderId.js';
import type { SKU } from '../value-objects/SKU.js';
import type { Money } from '../value-objects/Money.js';
import type { DomainEvent } from '../events/DomainEvent.js';
import { OrderCreated } from '../events/OrderCreated.js';
import { OrderItemAdded } from '../events/OrderItemAdded.js';
import { OrderPlaced } from '../events/OrderPlaced.js';
import type { OrderItem } from './OrderItem.js';

type OrderStatus = 'DRAFT' | 'PLACED';

export class Order {
  private readonly _items: OrderItem[] = [];
  private _status: OrderStatus = 'DRAFT';
  private readonly _events: DomainEvent[] = [];

  private constructor(
    readonly id: OrderId,
    readonly createdAt: Date,
  ) {}

  static create(id: OrderId, now: Date): Order {
    const order = new Order(id, now);
    order._events.push(new OrderCreated(id.value, id, now));
    return order;
  }

  get status(): OrderStatus {
    return this._status;
  }

  getItems(): ReadonlyArray<OrderItem> {
    return [...this._items];
  }

  addItem(item: OrderItem, now: Date): Result<void, DomainError> {
    if (this._status !== 'DRAFT') {
      return fail({ code: 'ORDER_NOT_DRAFT', message: 'Cannot add items to a non-draft order' });
    }

    // Merge lines with identical SKU + unit price (same amount and currency)
    const idx = this._items.findIndex(
      (i) =>
        i.sku.equals(item.sku) &&
        i.unitPrice.currency.equals(item.unitPrice.currency) &&
        i.unitPrice.amount === item.unitPrice.amount,
    );

    if (idx >= 0) {
      const existing = this._items[idx];
      if (existing === undefined) return fail({ code: 'ITEM_NOT_FOUND', message: 'Unexpected missing item' });
      this._items[idx] = existing.increaseBy(item.quantity);
    } else {
      this._items.push(item);
    }

    this._events.push(
      new OrderItemAdded(this.id.value, this.id, item.sku, item.unitPrice, item.quantity, now),
    );
    return ok(undefined);
  }

  removeItem(sku: SKU, now: Date): Result<void, DomainError> {
    if (this._status !== 'DRAFT') {
      return fail({ code: 'ORDER_NOT_DRAFT', message: 'Cannot remove items from a non-draft order' });
    }
    const idx = this._items.findIndex((i) => i.sku.equals(sku));
    if (idx < 0) {
      return fail({ code: 'ITEM_NOT_FOUND', message: `SKU ${sku.value} not found in order` });
    }
    this._items.splice(idx, 1);
    void now;
    return ok(undefined);
  }

  place(now: Date): Result<void, DomainError> {
    if (this._status !== 'DRAFT') {
      return fail({ code: 'ORDER_NOT_DRAFT', message: 'Order has already been placed' });
    }
    if (this._items.length === 0) {
      return fail({ code: 'ORDER_EMPTY', message: 'Cannot place an order with no items' });
    }
    this._status = 'PLACED';
    const totals = this.totalsByCurrency();
    this._events.push(new OrderPlaced(this.id.value, this.id, totals, now));
    return ok(undefined);
  }

  totalsByCurrency(): ReadonlyMap<string, Money> {
    const acc = new Map<string, Money>();
    for (const item of this._items) {
      const sub = item.subtotal();
      const key = sub.currency.value;
      const prev = acc.get(key);
      if (prev !== undefined) {
        const sumResult = prev.add(sub);
        if (sumResult.ok) acc.set(key, sumResult.value);
      } else {
        acc.set(key, sub);
      }
    }
    return acc;
  }

  pullEvents(): DomainEvent[] {
    const pending = [...this._events];
    this._events.length = 0;
    return pending;
  }
}
