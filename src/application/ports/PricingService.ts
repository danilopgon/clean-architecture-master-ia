import type { AppError } from '../errors.js';
import type { Result } from '../../shared/Result.js';
import type { SKU } from '../../domain/value-objects/SKU.js';
import type { Money } from '../../domain/value-objects/Money.js';

export interface PricingService {
  getUnitPrice(sku: SKU): Promise<Result<Money, AppError>>;
}