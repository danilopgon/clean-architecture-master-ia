import type { DomainError } from '../errors/DomainError.js';
import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';
import type { Currency } from './Currency.js';

export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static create(amount: number, currency: Currency): Result<Money, DomainError> {
    if (!Number.isInteger(amount)) {
      return fail({ code: 'INVALID_MONEY', message: 'amount must be an integer (cents)' });
    }
    if (amount < 0) {
      return fail({ code: 'INVALID_MONEY', message: 'amount must be >= 0' });
    }
    return ok(new Money(amount, currency));
  }

  add(other: Money): Result<Money, DomainError> {
    if (!this.currency.equals(other.currency)) {
      return fail({ code: 'CURRENCY_MISMATCH', message: `Cannot add ${this.currency.value} and ${other.currency.value}` });
    }
    return ok(new Money(this.amount + other.amount, this.currency));
  }

  multiply(factor: number): Result<Money, DomainError> {
    if (!Number.isInteger(factor) || factor < 0) {
      return fail({ code: 'INVALID_MONEY', message: 'factor must be a non-negative integer' });
    }
    return ok(new Money(this.amount * factor, this.currency));
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency.equals(other.currency);
  }
}
