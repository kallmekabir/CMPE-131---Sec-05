import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

export const SEED_PASSWORD = 'DevOnly-Password-1';
const day = 24 * 60 * 60 * 1000;
const inDays = (n: number, hour = 18) => {
  const d = new Date(Date.now() + n * day);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.');
  }

  await db.$executeRawUnsafe(
    'TRUNCATE TABLE participations, events, refresh_tokens, email_verification_tokens, users CASCADE',
  );
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 4);
  const account = (key: string, name: string, role: 'PARTICIPANT' | 'ORGANIZER', extra = {}) =>
    db.user.create({
      data: {
        name,
        displayName: name,
        universityEmail: `${key}@sjsu.edu`,
        passwordHash,
        role,
        emailVerified: true,
        ...extra,
      },
    });

  const organizer = await account('organizer.dev', 'Olivia Organizer', 'ORGANIZER');
  const organizer2 = await account('organizer2.dev', 'Owen Organizer', 'ORGANIZER');
  const participant = await account('participant.dev', 'Pat Participant', 'PARTICIPANT', {
    major: 'Computer Science',
    interests: ['music', 'hiking'],
    skills: ['react'],
  });
  await account('nonorganizer.dev', 'Nina NonOrganizer', 'PARTICIPANT');
  await account('unverified.dev', 'Uma Unverified', 'PARTICIPANT', { emailVerified: false });
  const fillers = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      account(`filler${i + 1}.dev`, `Filler ${i + 1}`, 'PARTICIPANT'),
    ),
  );

  const event = (title: string, over: Record<string, unknown> = {}) => {
    const startsAt = (over.startsAt as Date | undefined) ?? inDays(7);
    return db.event.create({
      data: {
        organizerId: organizer.id,
        title,
        description: `${title} - seeded development event.`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
        location: 'Student Union',
        capacity: 25,
        waitlistEnabled: false,
        tags: [],
        ...over,
      } as never,
    });
  };

  await event('Transfer Welcome Mixer', { tags: ['social', 'music'], startsAt: inDays(3) });
  await event('Hiking at Alum Rock', {
    tags: ['hiking', 'outdoors'],
    location: 'Alum Rock Park',
    startsAt: inDays(5),
  });
  await event('Resume Workshop', {
    organizerId: organizer2.id,
    tags: ['career'],
    startsAt: inDays(6),
  });
  const full = await event('FULL: No Waitlist', {
    capacity: 2,
    waitlistEnabled: false,
    startsAt: inDays(4),
  });
  const fullWait = await event('FULL: Waitlist Enabled', {
    capacity: 2,
    waitlistEnabled: true,
    startsAt: inDays(4),
  });
  await event('Open: Waitlist Enabled', { capacity: 10, waitlistEnabled: true });
  await event('Edge: Unlimited Capacity', { capacity: null, startsAt: inDays(10) });
  await event('Edge: Capacity Zero', { capacity: 0, waitlistEnabled: true, startsAt: inDays(10) });
  await event('Edge: No End Time', { endsAt: null, startsAt: inDays(11) });
  await event('Edge: Max Length Title ' + 'x'.repeat(98), { startsAt: inDays(12) });
  await event('Edge: Already Ended', { startsAt: inDays(-3), endsAt: inDays(-3, 20) });
  await event('Edge: Cancelled', { status: 'CANCELLED', deletedAt: new Date() });

  for (const f of fillers.slice(0, 2)) {
    await db.participation.create({ data: { userId: f.id, eventId: full.id, status: 'JOINED' } });
    await db.participation.create({
      data: { userId: f.id, eventId: fullWait.id, status: 'JOINED' },
    });
  }
  await db.participation.create({
    data: {
      userId: fillers[2]!.id,
      eventId: fullWait.id,
      status: 'WAITLISTED',
      queuedAt: new Date(),
    },
  });
  void participant;
  console.log(`Seeded dev data. All accounts use password: ${SEED_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
