import { loadConfig } from './config';
import { createLogger } from './logging/logger';
import { createDb } from './db/client';
import { createApp } from './app/createApp';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const db = createDb(config.databaseUrl);
const app = createApp({ config, db, logger });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'server listening');
});

const shutdown = () => {
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
