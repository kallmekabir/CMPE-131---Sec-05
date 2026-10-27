import { execSync } from 'node:child_process';

export default async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://spartin:spartin_dev_only@localhost:5433/spartin_test';
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
