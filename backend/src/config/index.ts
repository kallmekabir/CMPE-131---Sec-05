import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1209600),
  ALLOWED_EMAIL_DOMAINS: z.string().default('sjsu.edu'),
  AUTH_PROVIDER: z.enum(['dev', 'local']).default('local'),
  CORS_ORIGINS: z.string().default(''),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:8081'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  allowedEmailDomains: string[];
  authProvider: 'dev' | 'local';
  corsOrigins: string[];
  publicAppUrl: string;
  logLevel: string;
  authRateLimitMax: number;
  apiRateLimitMax: number;
};

const csv = (value: string) =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${fields.join('\n')}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production' && e.AUTH_PROVIDER === 'dev') {
    throw new Error('AUTH_PROVIDER=dev is not allowed when NODE_ENV=production');
  }
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    jwtAccessSecret: e.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: e.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: e.REFRESH_TOKEN_TTL_SECONDS,
    allowedEmailDomains: csv(e.ALLOWED_EMAIL_DOMAINS).map((d) => d.toLowerCase()),
    authProvider: e.AUTH_PROVIDER,
    corsOrigins: csv(e.CORS_ORIGINS),
    publicAppUrl: e.PUBLIC_APP_URL,
    logLevel: e.LOG_LEVEL,
    authRateLimitMax: e.AUTH_RATE_LIMIT_MAX,
    apiRateLimitMax: e.API_RATE_LIMIT_MAX,
  };
}
