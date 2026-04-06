import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import type { AppError } from '@application/errors.js';
import { infraError } from '@application/errors.js';
import type { Logger } from '@application/ports/Logger.js';
import { fail, ok, type Result } from '@shared/Result.js';
import { PinoLogger } from '../logging/PinoLogger.js';

loadEnv();

type OutboxRow = {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
  created_at: Date;
};

export type OutboxMessage = {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
};

export interface OutboxPublisher {
  publish(message: OutboxMessage): Promise<void>;
}

export class LoggingOutboxPublisher implements OutboxPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(message: OutboxMessage): Promise<void> {
    this.logger.info('Publishing outbox event', {
      id: message.id,
      aggregateId: message.aggregateId,
      eventType: message.eventType,
      createdAt: message.createdAt.toISOString(),
      payload: message.payload,
    });
  }
}

export class OutboxDispatcher {
  constructor(
    private readonly pool: Pool,
    private readonly publisher: OutboxPublisher,
    private readonly batchSize = 100,
  ) {}

  async dispatchPending(): Promise<Result<number, AppError>> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const rowsResult = await client.query<OutboxRow>(
        `
          SELECT id, aggregate_id, event_type, payload, created_at
          FROM outbox
          WHERE published_at IS NULL
          ORDER BY created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        `,
        [this.batchSize],
      );

      for (const row of rowsResult.rows) {
        await this.publisher.publish({
          id: row.id,
          aggregateId: row.aggregate_id,
          eventType: row.event_type,
          payload: row.payload,
          createdAt: row.created_at,
        });
      }

      if (rowsResult.rows.length > 0) {
        const ids = rowsResult.rows.map((row) => row.id);

        await client.query(
          `
            UPDATE outbox
            SET published_at = NOW()
            WHERE id = ANY($1::uuid[])
          `,
          [ids],
        );
      }

      await client.query('COMMIT');
      return ok(rowsResult.rows.length);
    } catch (error) {
      await this.rollbackQuietly(client);
      return fail(infraError('Failed to dispatch outbox messages', { cause: error }));
    } finally {
      client.release();
    }
  }

  private async rollbackQuietly(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve original dispatching error.
    }
  }
}

const runWorker = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run outbox dispatcher.');
  }

  const pollIntervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? '1000');
  const logger = new PinoLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    name: 'outbox-worker',
    prettyPrint: process.env.NODE_ENV !== 'production',
  }).child({ context: 'outbox-worker' });

  const pool = new Pool({ connectionString });
  const dispatcher = new OutboxDispatcher(pool, new LoggingOutboxPublisher(logger));

  logger.info('Outbox worker started', { pollIntervalMs });

  try {
    while (true) {
      const result = await dispatcher.dispatchPending();

      if (!result.ok) {
        logger.error('Outbox dispatch iteration failed', {
          errorType: result.error.type,
          errorMessage: result.error.message,
          details: result.error.details,
        });
      } else if (result.value > 0) {
        logger.info('Outbox messages dispatched', { count: result.value });
      }

      await sleep(pollIntervalMs);
    }
  } finally {
    await pool.end();
  }
};

const isMainModule = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runWorker().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const logger = new PinoLogger({
      level: 'error',
      name: 'outbox-worker',
      prettyPrint: process.env.NODE_ENV !== 'production',
    });
    logger.error('Outbox worker crashed', { message });
    process.exitCode = 1;
  });
}
