import type { AppError } from '../errors.js';
import type { Result } from '../../shared/Result.js';
import type { Order } from '../../domain/entities/Order.js';
import type { OrderId } from '../../domain/value-objects/OrderId.js';

export interface OrderRepository {
  findById(orderId: OrderId): Promise<Result<Order | null, AppError>>;
  save(order: Order): Promise<Result<void, AppError>>;
}

export type OrderRespository = OrderRepository;