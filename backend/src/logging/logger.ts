import pino from 'pino';

export type Logger = pino.Logger;

const redact = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
  '*.token',
];

export function createLogger(level: string): Logger {
  return pino({ level, redact: { paths: redact, censor: '[redacted]' } });
}
