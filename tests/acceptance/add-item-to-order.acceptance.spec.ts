import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrder } from '@application/use-cases/CreateOrder.js';
import { AddItemToOrder } from '@application/use-cases/AddItemToOrder.js';
import { CreateOrderDTO } from '@application/dtos/CreateOrderDTO.js';
import { AddItemToOrderDTO } from '@application/dtos/AddItemToOrderDTO.js';
import type { Clock } from '@application/ports/Clock.js';
import type { EventBus } from '@application/ports/EventBus.js';
import type { AppError } from '@application/errors.js';
import { ok, type Result } from '@shared/Result.js';
import { OrderId } from '@domain/value-objects/OrderId.js';
import type { DomainEvent } from '@domain/events/DomainEvent.js';
import { InMemoryOrderRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryOrderRepository.js';
import { StaticPricingService } from '../../src/infrastructure/http/StaticPricingService.js';

const NOW = new Date('2026-04-05T00:00:00Z');

class FixedClock implements Clock {
  now(): Date {
    return NOW;
  }
}

class RecordingEventBus implements EventBus {
  readonly events: DomainEvent[] = [];

  async publish(incoming: ReadonlyArray<DomainEvent>): Promise<Result<void, AppError>> {
    this.events.push(...incoming);
    return ok(undefined);
  }
}

function must<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error('unexpected failure: ' + JSON.stringify(result));
  return result.value;
}

describe('AddItemToOrder — acceptance', () => {
  let repo: InMemoryOrderRepository;
  let bus: RecordingEventBus;
  let createOrder: CreateOrder;
  let addItemToOrder: AddItemToOrder;

  beforeEach(() => {
    repo = new InMemoryOrderRepository();
    bus = new RecordingEventBus();
    const pricing = new StaticPricingService();
    const clock = new FixedClock();

    createOrder = new CreateOrder(repo, bus, clock);
    addItemToOrder = new AddItemToOrder(repo, pricing, bus, clock);
  });

  it('creates an order, adds two SKUs (merging duplicate lines), and persists the correct state', async () => {
    // 1. Create order
    const createDto = must(CreateOrderDTO.create({}));
    const { orderId } = must(await createOrder.execute(createDto));

    // 2. Add BOOK-001 x2
    must(await addItemToOrder.execute(
      must(AddItemToOrderDTO.create({ orderId, productId: 'BOOK-001', quantity: 2 })),
    ));

    // 3. Add BOOK-001 x1 again — should merge into the existing line
    must(await addItemToOrder.execute(
      must(AddItemToOrderDTO.create({ orderId, productId: 'BOOK-001', quantity: 1 })),
    ));

    // 4. Add BOOK-002 x1 — new line
    must(await addItemToOrder.execute(
      must(AddItemToOrderDTO.create({ orderId, productId: 'BOOK-002', quantity: 1 })),
    ));

    // --- Assert persisted order state ---
    const order = must(await repo.findById(must(OrderId.create(orderId))));
    expect(order).not.toBeNull();

    expect(order!.status).toBe('DRAFT');

    const items = order!.getItems();
    expect(items).toHaveLength(2);

    const book1 = items.find((i) => i.sku.value === 'BOOK-001');
    expect(book1).toBeDefined();
    expect(book1!.quantity.value).toBe(3);
    expect(book1!.unitPrice.amount).toBe(1200);
    expect(book1!.unitPrice.currency.value).toBe('EUR');

    const book2 = items.find((i) => i.sku.value === 'BOOK-002');
    expect(book2).toBeDefined();
    expect(book2!.quantity.value).toBe(1);
    expect(book2!.unitPrice.amount).toBe(1800);
    expect(book2!.unitPrice.currency.value).toBe('EUR');

    // --- Assert published events ---
    const names = bus.events.map((e) => e.name);
    expect(names).toEqual([
      'OrderCreated',
      'OrderItemAdded',
      'OrderItemAdded',
      'OrderItemAdded',
    ]);
  });
});
