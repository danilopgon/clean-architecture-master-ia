import type { AppError } from '../../application/errors.js';
import { infraError, notFoundError } from '../../application/errors.js';
import type { PricingService } from '../../application/ports/PricingService.js';
import { Currency } from '../../domain/value-objects/Currency.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { SKU } from '../../domain/value-objects/SKU.js';
import type { Result } from '../../shared/Result.js';
import { fail, ok } from '../../shared/Result.js';

type StaticPricingConfig = {
  readonly currency?: string;
  readonly pricesInCentsBySku?: Record<string, number>;
};

const DEFAULT_PRICES_IN_CENTS_BY_SKU: Record<string, number> = {
  'BOOK-001': 1200,
  'BOOK-002': 1800,
  'COURSE-001': 4900,
};

export class StaticPricingService implements PricingService {
  private readonly pricesInCentsBySku: Map<string, number>;
  private readonly currencyCode: string;

  constructor(config: StaticPricingConfig = {}) {
    this.currencyCode = config.currency ?? 'EUR';
    this.pricesInCentsBySku = new Map(
      Object.entries(
        config.pricesInCentsBySku ?? DEFAULT_PRICES_IN_CENTS_BY_SKU,
      ),
    );
  }

  async getUnitPrice(sku: SKU): Promise<Result<Money, AppError>> {
    const unitPriceInCents = this.pricesInCentsBySku.get(sku.value);
    if (unitPriceInCents === undefined) {
      return fail(
        notFoundError(`Price for SKU ${sku.value} was not found`, {
          sku: sku.value,
        }),
      );
    }

    const currencyResult = Currency.create(this.currencyCode);
    if (!currencyResult.ok) {
      return fail(
        infraError(
          'StaticPricingService currency is invalid',
          currencyResult.error,
        ),
      );
    }

    const moneyResult = Money.create(unitPriceInCents, currencyResult.value);
    if (!moneyResult.ok) {
      return fail(
        infraError('StaticPricingService has invalid configured price', {
          sku: sku.value,
          amount: unitPriceInCents,
          cause: moneyResult.error,
        }),
      );
    }

    return ok(moneyResult.value);
  }
}
