import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ServerDependencies } from '../../../application/ServerDependencies.js';
import type { AppError } from '../../../application/errors.js';
import { validationError } from '../../../application/errors.js';
import { AddItemToOrderDTO } from '../../../application/dtos/AddItemToOrderDTO.js';
import { CreateOrderDTO } from '../../../application/dtos/CreateOrderDTO.js';
import { OrderId } from '../../../domain/value-objects/OrderId.js';

export type OrdersControllerDeps = ServerDependencies;

type CreateOrderRequest = {
  Body: unknown;
};

type AddItemParams = {
  orderId: string;
};

type AddItemBody = Partial<{
  productId: string;
  quantity: number;
}>;

const mapErrorToStatusCode = (error: AppError): number => {
  switch (error.type) {
    case 'ValidationError':
      return 400;
    case 'NotFoundError':
      return 404;
    case 'ConflictError':
      return 409;
    case 'InfraError':
      return 503;
  }
};

const sendAppError = (reply: FastifyReply, error: AppError) => {
  const payload = {
    error: {
      type: error.type,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };

  return reply.code(mapErrorToStatusCode(error)).send(payload);
};

export class OrdersController {
  constructor(private readonly deps: OrdersControllerDeps) {}

  registerRoutes(app: FastifyInstance): void {
    const logger = this.deps.logger.child({ context: 'orders-controller' });

    app.post<CreateOrderRequest>('/orders', async (request, reply) => {
      const dtoResult = CreateOrderDTO.create(request.body);
      if (!dtoResult.ok) {
        logger.warn('Create order validation failed', { error: dtoResult.error.message });
        return sendAppError(reply, dtoResult.error);
      }

      const result = await this.deps.createOrder.execute(dtoResult.value);
      if (!result.ok) {
        logger.error('Create order failed', {
          errorType: result.error.type,
          errorMessage: result.error.message,
        });
        return sendAppError(reply, result.error);
      }

      logger.info('Order created', { orderId: result.value.orderId });

      return reply.code(201).send(result.value);
    });

    app.post<{ Params: AddItemParams; Body: AddItemBody }>(
      '/orders/:orderId/items',
      async (request, reply) => {
        const body = request.body ?? {};
        const dtoResult = AddItemToOrderDTO.create({
          orderId: request.params.orderId,
          productId: typeof body.productId === 'string' ? body.productId : '',
          quantity: body.quantity as number,
        });

        if (!dtoResult.ok) {
          logger.warn('Add item validation failed', {
            orderId: request.params.orderId,
            error: dtoResult.error.message,
          });
          return sendAppError(reply, dtoResult.error);
        }

        const addItemResult = await this.deps.addItemToOrder.execute(
          dtoResult.value,
        );
        if (!addItemResult.ok) {
          logger.error('Add item failed', {
            orderId: dtoResult.value.orderId,
            errorType: addItemResult.error.type,
            errorMessage: addItemResult.error.message,
          });
          return sendAppError(reply, addItemResult.error);
        }

        const orderIdResult = OrderId.create(dtoResult.value.orderId);
        if (!orderIdResult.ok) {
          logger.warn('Order id became invalid after update', {
            orderId: dtoResult.value.orderId,
            error: orderIdResult.error.message,
          });
          return sendAppError(
            reply,
            validationError(orderIdResult.error.message),
          );
        }

        const orderResult = await this.deps.orderRepository.findById(
          orderIdResult.value,
        );
        if (!orderResult.ok) {
          logger.error('Failed to fetch order after add item', {
            orderId: dtoResult.value.orderId,
            errorType: orderResult.error.type,
            errorMessage: orderResult.error.message,
          });
          return sendAppError(reply, orderResult.error);
        }
        if (orderResult.value === null) {
          logger.error('Order missing after successful item update', {
            orderId: dtoResult.value.orderId,
          });
          return sendAppError(
            reply,
            validationError('Order was updated but could not be read back'),
          );
        }

        const totals = Array.from(orderResult.value.totalsByCurrency()).map(
          ([currency, money]) => ({
            currency,
            amountInCents: money.amount,
          }),
        );

        logger.info('Item added to order', {
          orderId: orderResult.value.id.value,
          status: orderResult.value.status,
          totalCurrencies: totals.length,
        });

        return reply.code(200).send({
          orderId: orderResult.value.id.value,
          status: orderResult.value.status,
          totals,
        });
      },
    );
  }
}

export const registerOrdersControllers = (
  app: FastifyInstance,
  deps: OrdersControllerDeps,
) => {
  new OrdersController(deps).registerRoutes(app);
};
