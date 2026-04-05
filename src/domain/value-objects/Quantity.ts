import type { DomainError } from '../errors/DomainError.js';
import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';

export class Quantity {
  private constructor(readonly value: number) {}

  static create(value: number): Result<Quantity, DomainError> {
    if (!Number.isInteger(value) || value <= 0) {
      return fail({ code: 'INVALID_QUANTITY', message: 'quantity must be a positive integer' });
    }
    return ok(new Quantity(value));
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.value + other.value);
  }

  equals(other: Quantity): boolean {
    return this.value === other.value;
  }
}
