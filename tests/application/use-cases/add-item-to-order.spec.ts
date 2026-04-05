import { describe, expect, it } from 'vitest';
import { AddItemToOrder } from '@application/use-cases/AddItemToOrder.js';
import { AddItemToOrderDTO } from '@application/dtos/AddItemToOrderDTO.js';
import { infraError, notFoundError } from '@application/errors.js';
import type { Clock } from '@application/ports/Clock.js';
import type { EventBus } from '@application/ports/EventBus.js';
import type { OrderRepository } from '@application/ports/OrderRepository.js';
import type { PricingService } from '@application/ports/PricingService.js';
import { ok, fail, type Result } from '@shared/Result.js';
import type { AppError } from '@application/errors.js';
import { Order } from '@domain/entities/Order.js';
import { OrderId } from '@domain/value-objects/OrderId.js';
import { SKU } from '@domain/value-objects/SKU.js';
import { Currency } from '@domain/value-objects/Currency.js';
import { Money } from '@domain/value-objects/Money.js';
import { Quantity } from '@domain/value-objects/Quantity.js';
import { OrderItem } from '@domain/entities/OrderItem.js';
import type { DomainEvent } from '@domain/events/DomainEvent.js';

const NOW = new Date('2026-04-05T00:00:00Z');

function must<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error('unexpected result failure');
  }
  return result.value;
}

function makeOrder(id = 'order-1'): Order {
  return Order.create(must(OrderId.create(id)), NOW);
}

function makeMoney(amount: number, currency = 'EUR'): Money {
  return must(Money.create(amount, must(Currency.create(currency))));
}

function makeItem(
  skuValue = 'BOOK-001',
  amount = 1200,
  quantity = 1,
): OrderItem {
  return must(
    OrderItem.create({
      sku: must(SKU.create(skuValue)),
      unitPrice: makeMoney(amount),
      quantity: must(Quantity.create(quantity)),
    }),
  );
}

class FixedClock implements Clock {
  now(): Date {
    return NOW;
  }
}

class InMemoryRepo implements OrderRepository {
  constructor(private readonly store = new Map<string, Order>()) {}

  saveResult: Result<void, AppError> = ok(undefined);

  async findById(orderId: OrderId): Promise<Result<Order | null, AppError>> {
    return ok(this.store.get(orderId.value) ?? null);
  }

  async save(order: Order): Promise<Result<void, AppError>> {
    this.store.set(order.id.value, order);
    return this.saveResult;
  }
}

class FixedPricingService implements PricingService {
  priceResult: Result<Money, AppError> = ok(makeMoney(1200));

  async getUnitPrice(_sku: SKU): Promise<Result<Money, AppError>> {
    return this.priceResult;
  }
}

class SpyEventBus implements EventBus {
  publishResult: Result<void, AppError> = ok(undefined);
  published: DomainEvent[][] = [];

  async publish(
    events: ReadonlyArray<DomainEvent>,
  ): Promise<Result<void, AppError>> {
    this.published.push([...events]);
    return this.publishResult;
  }
}

function dto(
  orderId: string,
  productId: string,
  quantity: number,
): AddItemToOrderDTO {
  const result = AddItemToOrderDTO.create({ orderId, productId, quantity });
  if (!result.ok) throw new Error('unexpected dto failure');
  return result.value;
}

describe('AddItemToOrder use case', () => {
  it('adds item and publishes event', async () => {
    const order = makeOrder('order-1');
    order.pullEvents();
    const repo = new InMemoryRepo(new Map([[order.id.value, order]]));
    const pricing = new FixedPricingService();
    const bus = new SpyEventBus();
    const useCase = new AddItemToOrder(repo, pricing, bus, new FixedClock());

    const result = await useCase.execute(dto('order-1', 'BOOK-001', 2));
    expect(result.ok).toBe(true);
    expect(order.getItems()).toHaveLength(1);
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.[0]?.name).toBe('OrderItemAdded');
  });

  it('returns NotFoundError when order does not exist', async () => {
    const repo = new InMemoryRepo();
    const pricing = new FixedPricingService();
    const bus = new SpyEventBus();
    const useCase = new AddItemToOrder(repo, pricing, bus, new FixedClock());

    const result = await useCase.execute(dto('missing-order', 'BOOK-001', 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('NotFoundError');
    }
  });

  it('maps non-draft order to ConflictError', async () => {
    const order = makeOrder('order-2');
    must(order.addItem(makeItem(), NOW));
    must(order.place(NOW));
    order.pullEvents();

    const repo = new InMemoryRepo(new Map([[order.id.value, order]]));
    const pricing = new FixedPricingService();
    const bus = new SpyEventBus();
    const useCase = new AddItemToOrder(repo, pricing, bus, new FixedClock());

    const result = await useCase.execute(dto('order-2', 'BOOK-001', 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('ConflictError');
    }
  });

  it('propagates pricing infra errors', async () => {
    const order = makeOrder('order-3');
    order.pullEvents();

    const repo = new InMemoryRepo(new Map([[order.id.value, order]]));
    const pricing = new FixedPricingService();
    pricing.priceResult = fail(infraError('pricing unavailable'));
    const bus = new SpyEventBus();
    const useCase = new AddItemToOrder(repo, pricing, bus, new FixedClock());

    const result = await useCase.execute(dto('order-3', 'BOOK-001', 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('InfraError');
    }
  });

  it('propagates pricing not found errors', async () => {
    const order = makeOrder('order-4');
    order.pullEvents();

    const repo = new InMemoryRepo(new Map([[order.id.value, order]]));
    const pricing = new FixedPricingService();
    pricing.priceResult = fail(notFoundError('price not found'));
    const bus = new SpyEventBus();
    const useCase = new AddItemToOrder(repo, pricing, bus, new FixedClock());

    const result = await useCase.execute(dto('order-4', 'BOOK-001', 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('NotFoundError');
    }
  });
});
