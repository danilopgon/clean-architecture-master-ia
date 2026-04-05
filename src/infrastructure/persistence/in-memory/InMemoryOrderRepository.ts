import type { AppError } from '@application/errors.js';
import type { OrderRepository } from '@application/ports/OrderRepository.js';
import type { Order } from '@domain/entities/Order.js';
import type { OrderId } from '@domain/value-objects/OrderId.js';
import { ok, type Result } from '@shared/Result.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders: Map<string, Order> = new Map();

  async save(order: Order): Promise<Result<void, AppError>> {
    this.orders.set(order.id.value, order);
    return ok(undefined);
  }

  async findById(id: OrderId): Promise<Result<Order | null, AppError>> {
    return ok(this.orders.get(id.value) ?? null);
  }
}
