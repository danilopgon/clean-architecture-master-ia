import { Pool, type PoolConfig } from 'pg';

const DEFAULT_POOL_CONFIG: Pick<PoolConfig, 'max' | 'idleTimeoutMillis' | 'connectionTimeoutMillis'> = {
	max: 10,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
};

export const createPostgresPool = (
	connectionString: string,
	overrides: Partial<PoolConfig> = {},
): Pool => {
	return new Pool({
		...DEFAULT_POOL_CONFIG,
		connectionString,
		...overrides,
	});
};
