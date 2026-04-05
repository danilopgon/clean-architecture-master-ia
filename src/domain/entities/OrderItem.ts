import type { DomainError } from '../errors/DomainError.js';
import type { Result } from '../../shared/Result.js';
import { ok } from '../../shared/Result.js';
import type { SKU } from '../value-objects/SKU.js';
import type { Money } from '../value-objects/Money.js';
import type { Quantity } from '../value-objects/Quantity.js';

export class OrderItem {
  private constructor(
    readonly sku: SKU,
    readonly unitPrice: Money,
    readonly quantity: Quantity,
  ) {}

  static create(params: {
    sku: SKU;
    unitPrice: Money;
    quantity: Quantity;
  }): Result<OrderItem, DomainError> {
    return ok(new OrderItem(params.sku, params.unitPrice, params.quantity));
  }

  subtotal(): Money {
    const result = this.unitPrice.multiply(this.quantity.value);
    // Safe: quantity is always a positive integer and amount >= 0
    if (!result.ok) throw new Error('Unexpected subtotal failure');
    return result.value;
  }

  increaseBy(qty: Quantity): OrderItem {
    return new OrderItem(this.sku, this.unitPrice, this.quantity.add(qty));
  }

  equals(other: OrderItem): boolean {
    return (
      this.sku.equals(other.sku) &&
      this.unitPrice.equals(other.unitPrice) &&
      this.quantity.equals(other.quantity)
    );
  }
}
