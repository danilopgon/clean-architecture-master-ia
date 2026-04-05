import type { DomainError } from '../errors/DomainError.js';
import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';

export class Currency {
  private constructor(readonly value: string) {}

  static create(value: string): Result<Currency, DomainError> {
    if (!/^[A-Z]{3}$/.test(value)) {
      return fail({ code: 'INVALID_CURRENCY', message: `"${value}" is not a valid ISO-4217 currency code` });
    }
    return ok(new Currency(value));
  }

  equals(other: Currency): boolean {
    return this.value === other.value;
  }
}
