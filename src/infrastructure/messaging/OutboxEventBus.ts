import type { AppError } from '@application/errors.js';
import { infraError } from '@application/errors.js';
import type { EventBus } from '@application/ports/EventBus.js';
import type { DomainEvent } from '@domain/events/DomainEvent.js';
import { fail, ok, type Result } from '@shared/Result.js';
import type { Client, Pool } from 'pg';

type Queryable = Pick<Pool, 'query'> | Pick<Client, 'query'>;

type OutboxPayload = {
	eventName: string;
	occurredAt: string;
	aggregateId: string;
	data: unknown;
};

export class OutboxEventBus implements EventBus {
	constructor(private readonly db: Queryable) {}

	async publish(events: ReadonlyArray<DomainEvent>): Promise<Result<void, AppError>> {
		if (events.length === 0) {
			return ok(undefined);
		}

		try {
			for (const event of events) {
				const payload = this.toOutboxPayload(event);

				await this.db.query(
					`
						INSERT INTO outbox (aggregate_id, event_type, payload)
						VALUES ($1, $2, $3::jsonb)
					`,
					[event.aggregateId, event.name, JSON.stringify(payload)],
				);
			}

			return ok(undefined);
		} catch (error) {
			return fail(infraError('Failed to persist events in outbox', { cause: error }));
		}
	}

	private toOutboxPayload(event: DomainEvent): OutboxPayload {
		return {
			eventName: event.name,
			occurredAt: event.occurredAt.toISOString(),
			aggregateId: event.aggregateId,
			data: this.serializeForJson(event),
		};
	}

	private serializeForJson(value: unknown): unknown {
		if (value instanceof Date) {
			return value.toISOString();
		}

		if (value instanceof Map) {
			return Object.fromEntries(
				Array.from(value.entries()).map(([key, mapValue]) => [key, this.serializeForJson(mapValue)]),
			);
		}

		if (Array.isArray(value)) {
			return value.map((item) => this.serializeForJson(item));
		}

		if (value !== null && typeof value === 'object') {
			const serializedEntries = Object.entries(value as Record<string, unknown>).map(([key, objectValue]) => [
				key,
				this.serializeForJson(objectValue),
			]);

			return Object.fromEntries(serializedEntries);
		}

		return value;
	}
}

