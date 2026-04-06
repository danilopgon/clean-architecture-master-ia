import type { EventBus } from '@application/ports/EventBus.js';
import type { Logger } from '@application/ports/Logger.js';
import type { Pool } from 'pg';
import { createPostgresPool } from '../database/DatabaseFactory.js';
import { NoopEventBus } from './NoopEventBus.js';
import {
	LoggingOutboxPublisher,
	OutboxDispatcher,
	type OutboxPublisher,
} from './OutboxDispatcher.js';
import { OutboxEventBus } from './OutboxEventBus.js';

export type MessagingFactoryOptions = {
	useInMemory: boolean;
	databaseUrl: string;
	logger?: Logger;
	outboxPublisher?: OutboxPublisher;
	outboxBatchSize?: number;
};

export type MessagingComponents = {
	eventBus: EventBus;
	outboxDispatcher: OutboxDispatcher | null;
	pool: Pool | null;
};

export const createMessaging = (options: MessagingFactoryOptions): MessagingComponents => {
	if (options.useInMemory) {
		return {
			eventBus: new NoopEventBus(),
			outboxDispatcher: null,
			pool: null,
		};
	}

	const pool = createPostgresPool(options.databaseUrl);
	const eventBus = new OutboxEventBus(pool);
	const outboxPublisher = options.outboxPublisher
		?? (options.logger ? new LoggingOutboxPublisher(options.logger.child({ context: 'outbox-publisher' })) : undefined);

	if (!outboxPublisher) {
		throw new Error('Outbox publisher could not be resolved. Provide logger or outboxPublisher.');
	}
	const outboxDispatcher = new OutboxDispatcher(
		pool,
		outboxPublisher,
		options.outboxBatchSize,
	);

	return {
		eventBus,
		outboxDispatcher,
		pool,
	};
};
