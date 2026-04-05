import type { DomainError } from '../errors/DomainError.js';
import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';

/** Stock Keeping Unit: uppercase alphanumeric, hyphens and underscores allowed. e.g. "SHIRT-RED-L", "BOOK_001" */
export class SKU {
  private constructor(readonly value: string) {}

  static create(value: string): Result<SKU, DomainError> {
    const trimmed = value.trim();
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(trimmed)) {
      return fail({
        code: 'INVALID_ID',
        message: `"${value}" is not a valid SKU (uppercase alphanumeric, hyphens and underscores allowed)`,
      });
    }
    return ok(new SKU(trimmed));
  }

  equals(other: SKU): boolean {
    return this.value === other.value;
  }
}
