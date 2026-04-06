import { config } from 'dotenv';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');

async function getMigrationFiles(dir: string): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
		.map((entry) => path.join(dir, entry.name))
		.sort((a, b) => a.localeCompare(b));
}

async function runMigrations(): Promise<void> {
	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		throw new Error('DATABASE_URL is required in environment variables.');
	}

	const migrationFiles = await getMigrationFiles(MIGRATIONS_DIR);

	if (migrationFiles.length === 0) {
		console.log(`No migration files found in ${MIGRATIONS_DIR}`);
		return;
	}

	const client = new Client({ connectionString });
	await client.connect();

	try {
		await client.query(`
			CREATE TABLE IF NOT EXISTS schema_migrations (
				name VARCHAR(255) PRIMARY KEY,
				applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`);

		const appliedResult = await client.query<{ name: string }>(
			'SELECT name FROM schema_migrations',
		);
		const appliedMigrations = new Set(appliedResult.rows.map((row) => row.name));

		// Legacy baseline: when tracking is empty but schema already exists, mark first migration as applied.
		if (appliedMigrations.size === 0) {
			const userTablesResult = await client.query<{ table_count: string }>(`
				SELECT COUNT(*)::text AS table_count
				FROM information_schema.tables
				WHERE table_schema = 'public'
				  AND table_type = 'BASE TABLE'
				  AND table_name <> 'schema_migrations'
			`);
			const userTableCount = Number(userTablesResult.rows[0]?.table_count ?? '0');

			if (userTableCount > 0) {
				const baselineMigration = path.basename(migrationFiles[0]);
				await client.query(
					'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
					[baselineMigration],
				);
				appliedMigrations.add(baselineMigration);
				console.log(`Baselined migration: ${baselineMigration}`);
			}
		}

		for (const migrationPath of migrationFiles) {
			const fileName = path.basename(migrationPath);
			if (appliedMigrations.has(fileName)) {
				console.log(`Skipping already applied migration: ${fileName}`);
				continue;
			}

			const sql = await fs.readFile(migrationPath, 'utf8');

			console.log(`Running migration: ${fileName}`);
			await client.query('BEGIN');

			try {
				await client.query(sql);
				await client.query(
					'INSERT INTO schema_migrations (name) VALUES ($1)',
					[fileName],
				);
				await client.query('COMMIT');
				console.log(`Migration completed: ${fileName}`);
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			}
		}

		console.log('All migrations executed successfully.');
	} finally {
		await client.end();
	}
}

runMigrations().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Migration failed: ${message}`);
	process.exitCode = 1;
});
