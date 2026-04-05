import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';
import type { ValidationError } from '../errors.js';
import { validationError } from '../errors.js';

export class CreateOrderDTO {
  private constructor() {}

  static create(input: unknown): Result<CreateOrderDTO, ValidationError> {
    if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) {
      return fail(validationError('CreateOrder input must be an object', { input }));
    }

    return ok(new CreateOrderDTO());
  }
}