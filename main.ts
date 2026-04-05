import { buildContainer } from './src/composition/container.js';
import { buildServer } from './src/infrastructure/http/server.js';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

const parsePort = (value: string | undefined): number => {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_PORT;
  }

  return parsed;
};

const start = async (): Promise<void> => {
  const deps = buildContainer();
  const app = buildServer(deps);

  const host = process.env.HOST ?? DEFAULT_HOST;
  const port = parsePort(process.env.PORT);

  const shutdown = async (signal: string): Promise<void> => {
    try {
      app.log.info({ signal }, 'Shutting down server');
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error(error, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    const address = await app.listen({ host, port });
    app.log.info({ address, host, port }, 'Server running at');
  } catch (error) {
    app.log.error(error, 'Failed to start HTTP server');
    process.exit(1);
  }
};

void start();
