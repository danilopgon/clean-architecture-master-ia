import { describe, expect, it } from 'vitest';
import { CreateOrder } from '@application/use-cases/CreateOrder.js';
import { CreateOrderDTO } from '@application/dtos/CreateOrderDTO.js';
import { infraError } from '@application/errors.js';
import type { Clock } from '@application/ports/Clock.js';
import type { EventBus } from '@application/ports/EventBus.js';
import type { OrderRepository } from '@application/ports/OrderRepository.js';
import { ok, fail, type Result } from '@shared/Result.js';
import type { AppError } from '@application/errors.js';
import type { Order } from '@domain/entities/Order.js';
import type { OrderId } from '@domain/value-objects/OrderId.js';
import type { DomainEvent } from '@domain/events/DomainEvent.js';

const NOW = new Date('2026-04-05T00:00:00Z');

class FixedClock implements Clock {
  now(): Date {
    return NOW;
  }
}

class InMemoryRepo implements OrderRepository {
  saved: Order[] = [];
  saveResult: Result<void, AppError> = ok(undefined);

  async findById(_orderId: OrderId): Promise<Result<Order | null, AppError>> {
    return ok(null);
  }

  async save(order: Order): Promise<Result<void, AppError>> {
    this.saved.push(order);
    return this.saveResult;
  }
}

class SpyEventBus implements EventBus {
  published: DomainEvent[][] = [];
  publishResult: Result<void, AppError> = ok(undefined);

  async publish(events: ReadonlyArray<DomainEvent>): Promise<Result<void, AppError>> {
    this.published.push([...events]);
    return this.publishResult;
  }
}

function dto(): CreateOrderDTO {
  const result = CreateOrderDTO.create({});
  if (!result.ok) throw new Error('unexpected dto failure');
  return result.value;
}

describe('CreateOrder use case', () => {
  it('creates and returns a new order id', async () => {
    const repo = new InMemoryRepo();
    const bus = new SpyEventBus();
    const useCase = new CreateOrder(repo, bus, new FixedClock());

    const result = await useCase.execute(dto());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.orderId.length).toBeGreaterThan(0);
    }
    expect(repo.saved).toHaveLength(1);
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.[0]?.name).toBe('OrderCreated');
  });

  it('maps publication failures to InfraError', async () => {
    const repo = new InMemoryRepo();
    const bus = new SpyEventBus();
    bus.publishResult = fail(infraError('bus unavailable'));
    const useCase = new CreateOrder(repo, bus, new FixedClock());

    const result = await useCase.execute(dto());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('InfraError');
    }
  });
});