import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const EVENTS = Number(process.env.LOAD_EVENTS ?? 1200);
const USERS = Number(process.env.LOAD_USERS ?? 300);
const day = 24 * 60 * 60 * 1000;

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production.');
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE participations, events, refresh_tokens, email_verification_tokens, users CASCADE',
  );
  const passwordHash = await bcrypt.hash('Load-Test-Password-1', 4);
  await db.user.create({
    data: {
      name: 'Load Organizer',
      displayName: 'Load Organizer',
      universityEmail: 'load.organizer@sjsu.edu',
      passwordHash,
      role: 'ORGANIZER',
      emailVerified: true,
    },
  });
  const organizer = await db.user.findUniqueOrThrow({
    where: { universityEmail: 'load.organizer@sjsu.edu' },
  });
  await db.user.createMany({
    data: Array.from({ length: USERS }, (_, i) => ({
      name: `Load User ${i}`,
      displayName: `Load User ${i}`,
      universityEmail: `load.user${i}@sjsu.edu`,
      passwordHash,
      emailVerified: true,
      interests: ['music'],
    })),
  });
  const tags = ['music', 'career', 'social', 'sports', 'food', 'study'];
  await db.event.createMany({
    data: Array.from({ length: EVENTS }, (_, i) => ({
      organizerId: organizer.id,
      title: `Load Event ${i}`,
      description: 'Generated for load testing.',
      startsAt: new Date(Date.now() + (1 + (i % 120)) * day),
      location: `Room ${i % 50}`,
      capacity: i % 4 === 0 ? 20 : i % 4 === 1 ? null : 200,
      waitlistEnabled: i % 2 === 0,
      tags: [tags[i % tags.length]!],
    })),
  });
  console.log(`Seeded ${EVENTS} events and ${USERS} users (password: Load-Test-Password-1).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
