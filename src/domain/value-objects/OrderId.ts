import type { DomainError } from '../errors/DomainError.js';
import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';

export class OrderId {
  private constructor(readonly value: string) {}

  static create(value: string): Result<OrderId, DomainError> {
    if (value.trim().length === 0) {
      return fail({ code: 'INVALID_ID', message: 'OrderId cannot be empty' });
    }
    return ok(new OrderId(value.trim()));
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }
}
