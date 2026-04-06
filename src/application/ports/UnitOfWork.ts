import type { AppError } from '../errors.js';
import type { Result } from '../../shared/Result.js';
import type { OrderRepository } from './OrderRepository.js';

export interface UnitOfWork {
  run<T>(callback: () => Promise<Result<T, AppError>>): Promise<Result<T, AppError>>;
  getOrders(): OrderRepository;
}
