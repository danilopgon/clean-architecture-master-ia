import { Client } from 'pg';
import { fail, type Result } from '../../../shared/Result.js';
import type { AppError } from '../../../application/errors.js';
import { infraError } from '../../../application/errors.js';
import type { OrderRepository } from '../../../application/ports/OrderRepository.js';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork.js';
import { PostgresOrderRepository } from './PostgresOrderRepository.js';

export class PgUnitOfWork implements UnitOfWork {
  private client: Client;
  private orderRepository: PostgresOrderRepository | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  async run<T>(callback: () => Promise<Result<T, AppError>>): Promise<Result<T, AppError>> {
    await this.client.query('BEGIN');
    try {
      this.orderRepository = new PostgresOrderRepository(this.client);

      const result = await callback();

      if (!result.ok) {
        await this.client.query('ROLLBACK');
        return result;
      }

      await this.client.query('COMMIT');
      return result;
    } catch (error) {
      await this.client.query('ROLLBACK');
      return fail(infraError('Unit of work execution failed', { cause: error }));
    }
  }

  getOrders(): OrderRepository {
    if (this.orderRepository === null) {
      throw new Error('Order repository is only available inside UnitOfWork.run()');
    }
    return this.orderRepository;
  }
}
