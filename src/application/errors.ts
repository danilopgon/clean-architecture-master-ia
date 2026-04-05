import type { DomainError } from '../domain/errors/DomainError.js';

export type ValidationError = {
	readonly type: 'ValidationError';
	readonly message: string;
	readonly details?: unknown;
};

export type NotFoundError = {
	readonly type: 'NotFoundError';
	readonly message: string;
	readonly details?: unknown;
};

export type ConflictError = {
	readonly type: 'ConflictError';
	readonly message: string;
	readonly details?: unknown;
};

export type InfraError = {
	readonly type: 'InfraError';
	readonly message: string;
	readonly details?: unknown;
};

export type AppError =
	| ValidationError
	| NotFoundError
	| ConflictError
	| InfraError;

export const validationError = (message: string, details?: unknown): ValidationError => ({
	type: 'ValidationError',
	message,
	details,
});

export const notFoundError = (message: string, details?: unknown): NotFoundError => ({
	type: 'NotFoundError',
	message,
	details,
});

export const conflictError = (message: string, details?: unknown): ConflictError => ({
	type: 'ConflictError',
	message,
	details,
});

export const infraError = (message: string, details?: unknown): InfraError => ({
	type: 'InfraError',
	message,
	details,
});

export const mapDomainErrorToAppError = (error: DomainError): AppError => {
	switch (error.code) {
		case 'INVALID_CURRENCY':
		case 'INVALID_MONEY':
		case 'INVALID_QUANTITY':
		case 'INVALID_ID':
			return validationError(error.message, { code: error.code });
		case 'ITEM_NOT_FOUND':
			return notFoundError(error.message, { code: error.code });
		case 'ORDER_NOT_DRAFT':
		case 'ORDER_EMPTY':
		case 'CURRENCY_MISMATCH':
			return conflictError(error.message, { code: error.code });
	}
};
