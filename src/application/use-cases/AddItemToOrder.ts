import type { Result } from '../../shared/Result.js';
import { fail, ok } from '../../shared/Result.js';
import type { AppError } from '../errors.js';
import {
  infraError,
  mapDomainErrorToAppError,
  notFoundError,
} from '../errors.js';
import type { OrderRepository } from '../ports/OrderRepository.js';
import type { PricingService } from '../ports/PricingService.js';
import type { EventBus } from '../ports/EventBus.js';
import type { Clock } from '../ports/Clock.js';
import type { AddItemToOrderDTO } from '../dtos/AddItemToOrderDTO.js';
import { OrderId } from '../../domain/value-objects/OrderId.js';
import { SKU } from '../../domain/value-objects/SKU.js';
import { Quantity } from '../../domain/value-objects/Quantity.js';
import { OrderItem } from '../../domain/entities/OrderItem.js';

export class AddItemToOrder {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly pricingService: PricingService,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
  ) {}

  async execute(dto: AddItemToOrderDTO): Promise<Result<void, AppError>> {
    const orderIdResult = OrderId.create(dto.orderId);
    if (!orderIdResult.ok) {
      return fail(mapDomainErrorToAppError(orderIdResult.error));
    }

    const skuResult = SKU.create(dto.productId);
    if (!skuResult.ok) {
      return fail(mapDomainErrorToAppError(skuResult.error));
    }

    const quantityResult = Quantity.create(dto.quantity);
    if (!quantityResult.ok) {
      return fail(mapDomainErrorToAppError(quantityResult.error));
    }

    const orderResult = await this.orderRepository.findById(orderIdResult.value);
    if (!orderResult.ok) {
      return fail(orderResult.error);
    }

    const order = orderResult.value;
    if (order === null) {
      return fail(notFoundError(`Order ${dto.orderId} was not found`, { orderId: dto.orderId }));
    }

    const unitPriceResult = await this.pricingService.getUnitPrice(skuResult.value);
    if (!unitPriceResult.ok) {
      return fail(unitPriceResult.error);
    }

    const itemResult = OrderItem.create({
      sku: skuResult.value,
      unitPrice: unitPriceResult.value,
      quantity: quantityResult.value,
    });
    if (!itemResult.ok) {
      return fail(mapDomainErrorToAppError(itemResult.error));
    }

    const addItemResult = order.addItem(itemResult.value, this.clock.now());
    if (!addItemResult.ok) {
      return fail(mapDomainErrorToAppError(addItemResult.error));
    }

    const saveResult = await this.orderRepository.save(order);
    if (!saveResult.ok) {
      return fail(saveResult.error);
    }

    const events = order.pullEvents();
    if (events.length > 0) {
      const publishResult = await this.eventBus.publish(events);
      if (!publishResult.ok) {
        return fail(infraError('Order update persisted but event publication failed', publishResult.error));
      }
    }

    return ok(undefined);
  }
}