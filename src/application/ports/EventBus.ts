import type { AppError } from '../errors.js';
import type { Result } from '../../shared/Result.js';
import type { DomainEvent } from '../../domain/events/DomainEvent.js';

export interface EventBus {
  publish(events: ReadonlyArray<DomainEvent>): Promise<Result<void, AppError>>;
}