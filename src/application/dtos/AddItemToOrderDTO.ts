import type { Result } from '../../shared/Result.js';
import { ok, fail } from '../../shared/Result.js';
import type { ValidationError } from '../errors.js';
import { validationError } from '../errors.js';

export class AddItemToOrderDTO {
  private constructor(
    readonly orderId: string,
    readonly productId: string,
    readonly quantity: number,
  ) {}

  static create(input: {
    orderId: string;
    productId: string;
    quantity: number;
  }): Result<AddItemToOrderDTO, ValidationError> {
    const orderId = input.orderId?.trim();
    if (!orderId) {
      return fail(validationError('orderId is required'));
    }

    const productId = input.productId?.trim();
    if (!productId) {
      return fail(validationError('productId is required'));
    }

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      return fail(validationError('quantity must be a positive integer', { quantity: input.quantity }));
    }

    return ok(new AddItemToOrderDTO(orderId, productId, input.quantity));
  }
}