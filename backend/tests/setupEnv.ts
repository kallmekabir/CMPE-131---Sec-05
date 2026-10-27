process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://spartin:spartin_dev_only@localhost:5433/spartin_test';
process.env.JWT_ACCESS_SECRET = 'test-only-access-secret-at-least-32-characters';
process.env.AUTH_PROVIDER = 'dev';
process.env.LOG_LEVEL = 'silent';
process.env.ALLOWED_EMAIL_DOMAINS = 'sjsu.edu';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '100000';
