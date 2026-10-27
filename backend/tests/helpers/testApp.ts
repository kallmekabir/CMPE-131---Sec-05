import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { loadConfig } from '../../src/config';
import { createDb } from '../../src/db/client';
import { createLogger } from '../../src/logging/logger';
import { createApp } from '../../src/app/createApp';
import { InMemoryEmailAdapter } from '../../src/adapters/email/EmailAdapter';
import { createDevAuthProvider } from '../../src/adapters/authentication/AuthProvider';

export const TEST_PASSWORD = 'Test-Password-123';

export function buildTestApp(envOverrides: Record<string, string> = {}) {
  const config = loadConfig({ ...process.env, ...envOverrides });
  const db = createDb(config.databaseUrl);
  const email = new InMemoryEmailAdapter();
  const app = createApp({ config, db, logger: createLogger('silent'), email });
  return { app, db, email, config };
}

export type TestApp = ReturnType<typeof buildTestApp>;

export async function resetDatabase(db: TestApp['db']) {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE participations, events, refresh_tokens, email_verification_tokens, users CASCADE',
  );
}

export async function createUser(
  db: TestApp['db'],
  overrides: { email?: string; role?: UserRole; emailVerified?: boolean; name?: string } = {},
) {
  const email = overrides.email ?? `user${Math.random().toString(36).slice(2, 10)}@sjsu.edu`;
  return db.user.create({
    data: {
      name: overrides.name ?? 'Test User',
      displayName: overrides.name ?? 'Test User',
      universityEmail: email,
      passwordHash: await createDevAuthProvider().hashPassword(TEST_PASSWORD),
      role: overrides.role ?? 'PARTICIPANT',
      emailVerified: overrides.emailVerified ?? true,
    },
  });
}

export function tokenFor(userId: string, role: UserRole, options: jwt.SignOptions = {}) {
  return jwt.sign({ role }, process.env.JWT_ACCESS_SECRET as string, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: 600,
    ...options,
  });
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createEvent(
  db: TestApp['db'],
  organizerId: string,
  overrides: Partial<{
    title: string;
    capacity: number | null;
    waitlistEnabled: boolean;
    startsAt: Date;
    endsAt: Date | null;
    tags: string[];
    status: 'ACTIVE' | 'CANCELLED';
    deletedAt: Date | null;
  }> = {},
) {
  return db.event.create({
    data: {
      organizerId,
      title: overrides.title ?? 'Transfer Meetup',
      description: 'Meet other transfer students.',
      startsAt: overrides.startsAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000),
      endsAt: overrides.endsAt ?? null,
      location: 'Student Union',
      capacity: overrides.capacity === undefined ? 10 : overrides.capacity,
      waitlistEnabled: overrides.waitlistEnabled ?? false,
      tags: overrides.tags ?? [],
      status: overrides.status ?? 'ACTIVE',
      deletedAt: overrides.deletedAt ?? null,
    },
  });
}

export async function actor(db: TestApp['db'], role: UserRole = 'PARTICIPANT') {
  const user = await createUser(db, { role });
  return { user, headers: bearer(tokenFor(user.id, role)) };
}
