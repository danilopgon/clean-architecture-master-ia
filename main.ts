import { buildContainer } from './src/composition/container.js';
import { config } from './src/composition/config.js';
import { buildServer } from './src/infrastructure/http/server.js';

const start = async (): Promise<void> => {
  const container = buildContainer();
  const app = buildServer(container);

  const host = config.HOST;
  const port = config.PORT;

  const shutdown = async (signal: string): Promise<void> => {
    try {
      app.log.info({ signal }, 'Shutting down server');
      await app.close();
      await container.shutdown();
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
