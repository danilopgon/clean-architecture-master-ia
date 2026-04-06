import type { AppError } from '@application/errors.js';
import { infraError } from '@application/errors.js';
import type { OrderRepository } from '@application/ports/OrderRepository.js';
import { Order } from '@domain/entities/Order.js';
import { OrderItem } from '@domain/entities/OrderItem.js';
import { Currency } from '@domain/value-objects/Currency.js';
import { Money } from '@domain/value-objects/Money.js';
import { OrderId } from '@domain/value-objects/OrderId.js';
import { Quantity } from '@domain/value-objects/Quantity.js';
import { SKU } from '@domain/value-objects/SKU.js';
import { fail, ok, type Result } from '@shared/Result.js';
import type { Client, Pool, PoolClient, QueryResult } from 'pg';

const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_CURRENCY_CODE = 'EUR';

type PersistedOrderStatus = 'DRAFT' | 'PLACED';

type OrderRow = {
	id: string;
	status: string;
	created_at: Date;
};

type OrderItemRow = {
	product_id: string;
	quantity: number;
	unit_price: string | number;
};

type Queryable = Pick<Pool, 'query'>;

type DbLike = Pool | Client;

export class PostgresOrderRepository implements OrderRepository {
	constructor(private readonly db: DbLike) {}

	async findById(orderId: OrderId): Promise<Result<Order | null, AppError>> {
		try {
			const orderQuery = await this.db.query<OrderRow>(
				`
					SELECT id, status, created_at
					FROM orders
					WHERE id = $1
				`,
				[orderId.value],
			);

			const row = orderQuery.rows[0];
			if (row === undefined) {
				return ok(null);
			}

			const itemQuery = await this.db.query<OrderItemRow>(
				`
					SELECT product_id, quantity, unit_price
					FROM order_items
					WHERE order_id = $1
					ORDER BY created_at ASC
				`,
				[orderId.value],
			);

			const mapResult = this.mapToOrder(row, itemQuery);
			if (!mapResult.ok) {
				return fail(mapResult.error);
			}

			return ok(mapResult.value);
		} catch (error) {
			return fail(infraError('Failed to load order from PostgreSQL', { cause: error, orderId: orderId.value }));
		}
	}

	async save(order: Order): Promise<Result<void, AppError>> {
		const totalResult = this.toPersistedTotal(order);
		if (!totalResult.ok) {
			return fail(totalResult.error);
		}

		if (this.isPool(this.db)) {
			const client = await this.db.connect();

			try {
				await client.query('BEGIN');
				await this.persistOrder(client, order, totalResult.value);
				await client.query('COMMIT');
				return ok(undefined);
			} catch (error) {
				await this.rollbackQuietly(client);
				return fail(infraError('Failed to persist order in PostgreSQL', { cause: error, orderId: order.id.value }));
			} finally {
				client.release();
			}
		}

		try {
			await this.persistOrder(this.db, order, totalResult.value);
			return ok(undefined);
		} catch (error) {
			return fail(infraError('Failed to persist order in PostgreSQL', { cause: error, orderId: order.id.value }));
		}
	}

	private async persistOrder(client: Queryable, order: Order, persistedTotal: number): Promise<void> {
		await client.query(
			`
				INSERT INTO orders (id, customer_id, status, total_amount, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $5)
				ON CONFLICT (id)
				DO UPDATE SET
					status = EXCLUDED.status,
					total_amount = EXCLUDED.total_amount,
					updated_at = EXCLUDED.updated_at
			`,
			[
				order.id.value,
				DEFAULT_CUSTOMER_ID,
				order.status,
				persistedTotal,
				order.createdAt,
			],
		);

		await client.query('DELETE FROM order_items WHERE order_id = $1', [order.id.value]);

		for (const item of order.getItems()) {
			await client.query(
				`
					INSERT INTO order_items (order_id, product_id, quantity, unit_price)
					VALUES ($1, $2, $3, $4)
				`,
				[
					order.id.value,
					item.sku.value,
					item.quantity.value,
					this.centsToDecimal(item.unitPrice.amount),
				],
			);
		}
	}

	private isPool(db: DbLike): db is Pool {
		return 'totalCount' in db;
	}

	private mapToOrder(orderRow: OrderRow, itemsResult: QueryResult<OrderItemRow>): Result<Order, AppError> {
		const orderIdResult = OrderId.create(orderRow.id);
		if (!orderIdResult.ok) {
			return fail(infraError('Invalid order id in persistence layer', { orderId: orderRow.id, error: orderIdResult.error }));
		}

		const currencyResult = Currency.create(DEFAULT_CURRENCY_CODE);
		if (!currencyResult.ok) {
			return fail(infraError('Invalid default currency configuration', { error: currencyResult.error }));
		}

		const items: OrderItem[] = [];
		for (const itemRow of itemsResult.rows) {
			const skuResult = SKU.create(itemRow.product_id.toUpperCase());
			if (!skuResult.ok) {
				return fail(infraError('Invalid SKU in persistence layer', { productId: itemRow.product_id, error: skuResult.error }));
			}

			const quantityResult = Quantity.create(itemRow.quantity);
			if (!quantityResult.ok) {
				return fail(infraError('Invalid quantity in persistence layer', { quantity: itemRow.quantity, error: quantityResult.error }));
			}

			const amountInCents = this.decimalToCents(itemRow.unit_price);
			const moneyResult = Money.create(amountInCents, currencyResult.value);
			if (!moneyResult.ok) {
				return fail(infraError('Invalid unit price in persistence layer', { amountInCents, error: moneyResult.error }));
			}

			const itemResult = OrderItem.create({
				sku: skuResult.value,
				quantity: quantityResult.value,
				unitPrice: moneyResult.value,
			});

			if (!itemResult.ok) {
				return fail(infraError('Invalid order item in persistence layer', { error: itemResult.error }));
			}

			items.push(itemResult.value);
		}

		const statusResult = this.parseStatus(orderRow.status);
		if (!statusResult.ok) {
			return fail(statusResult.error);
		}

		const order = this.hydrateOrder(
			orderIdResult.value,
			orderRow.created_at,
			statusResult.value,
			items,
		);

		return ok(order);
	}

	private parseStatus(status: string): Result<PersistedOrderStatus, AppError> {
		if (status === 'DRAFT' || status === 'PLACED') {
			return ok(status);
		}

		return fail(infraError('Invalid order status in persistence layer', { status }));
	}

	private hydrateOrder(
		orderId: OrderId,
		createdAt: Date,
		status: PersistedOrderStatus,
		items: OrderItem[],
	): Order {
		const order = Order.create(orderId, createdAt);

		type MutableOrderState = {
			_items: OrderItem[];
			_status: PersistedOrderStatus;
			_events: unknown[];
		};

		const state = order as unknown as MutableOrderState;
		state._items.push(...items);
		state._status = status;
		state._events = [];

		return order;
	}

	private toPersistedTotal(order: Order): Result<number, AppError> {
		const totals = Array.from(order.totalsByCurrency().values());

		if (totals.length === 0) {
			return ok(0);
		}

		if (totals.length > 1) {
			return fail(infraError('Current PostgreSQL schema only supports a single-currency total', {
				currencies: Array.from(order.totalsByCurrency().keys()),
			}));
		}

		const total = totals[0];
		if (total === undefined) {
			return ok(0);
		}

		return ok(this.centsToDecimal(total.amount));
	}

	private decimalToCents(value: string | number): number {
		const asNumber = typeof value === 'number' ? value : Number(value);
		return Math.round(asNumber * 100);
	}

	private centsToDecimal(valueInCents: number): number {
		return valueInCents / 100;
	}

	private async rollbackQuietly(client: PoolClient): Promise<void> {
		try {
			await client.query('ROLLBACK');
		} catch {
			// Intentionally ignored to preserve the original persistence error.
		}
	}
}
