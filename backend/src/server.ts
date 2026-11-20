import { loadConfig } from './config';
import { createLogger } from './logging/logger';
import { createDb } from './db/client';
import { createApp } from './app/createApp';
import { SmtpEmailAdapter } from './adapters/email/EmailAdapter';

const config = loadConfig();
const logger = createLogger(config.logLevel);
if (config.skipEmailVerification) {
  logger.warn(
    'BETA_SKIP_EMAIL_VERIFICATION is on: accounts are verified without email confirmation',
  );
}
const db = createDb(config.databaseUrl);
const app = createApp({
  config,
  db,
  logger,
  email: config.smtp ? new SmtpEmailAdapter(config.smtp) : undefined,
});

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
