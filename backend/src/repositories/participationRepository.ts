import type { Participation, ParticipationStatus, Prisma } from '@prisma/client';
import type { Db } from '../db/client';
import { openSpots } from '../domain/capacity';
import type { LockedEvent } from './eventRepository';

type Tx = Prisma.TransactionClient;

export const joinedCountIn = (tx: Tx, eventId: string) =>
  tx.participation.count({ where: { eventId, status: 'JOINED' } });

export const waitlistPositionIn = async (
  tx: Tx | Db,
  eventId: string,
  p: Pick<Participation, 'id' | 'queuedAt'>,
): Promise<number> => {
  if (!p.queuedAt) return 0;
  const ahead = await tx.participation.count({
    where: {
      eventId,
      status: 'WAITLISTED',
      OR: [{ queuedAt: { lt: p.queuedAt } }, { queuedAt: p.queuedAt, id: { lt: p.id } }],
    },
  });
  return ahead + 1;
};

/**
 * Invariant: caller holds the event row lock (EventRepository.lock), so no other
 * transaction can change joined/waitlisted rows for this event while this runs.
 * Waitlist order is (queued_at, participation_id), which is total and stable.
 */
export async function promoteWaitlist(tx: Tx, event: Pick<LockedEvent, 'id' | 'capacity'>) {
  const joined = await joinedCountIn(tx, event.id);
  const spots = openSpots(event.capacity, joined);
  if (spots <= 0) return [];
  const next = await tx.participation.findMany({
    where: { eventId: event.id, status: 'WAITLISTED' },
    orderBy: [{ queuedAt: 'asc' }, { id: 'asc' }],
    take: Number.isFinite(spots) ? spots : undefined,
  });
  if (next.length === 0) return [];
  await tx.participation.updateMany({
    where: { id: { in: next.map((p) => p.id) } },
    data: { status: 'JOINED', queuedAt: null },
  });
  return next.map((p) => p.userId);
}

export class ParticipationRepository {
  constructor(private readonly db: Db) {}

  findForUser(userId: string, eventId: string) {
    return this.db.participation.findUnique({ where: { userId_eventId: { userId, eventId } } });
  }

  async viewerStatuses(userId: string, eventIds: string[]) {
    if (eventIds.length === 0) return new Map<string, Participation>();
    const rows = await this.db.participation.findMany({
      where: { userId, eventId: { in: eventIds } },
    });
    return new Map(rows.map((r) => [r.eventId, r]));
  }

  waitlistPosition(eventId: string, p: Pick<Participation, 'id' | 'queuedAt'>) {
    return waitlistPositionIn(this.db, eventId, p);
  }

  listForUser(userId: string, statuses: ParticipationStatus[], take: number) {
    return this.db.participation.findMany({
      where: { userId, status: { in: statuses }, event: { deletedAt: null, status: 'ACTIVE' } },
      orderBy: [{ event: { startsAt: 'asc' } }, { id: 'asc' }],
      take,
    });
  }

  listForEvent(eventId: string, take: number) {
    return this.db.participation.findMany({
      where: { eventId, status: { in: ['JOINED', 'WAITLISTED'] } },
      orderBy: [{ status: 'asc' }, { queuedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take,
      include: { user: { select: { id: true, displayName: true, major: true } } },
    });
  }

  countByStatus(eventId: string) {
    return this.db.participation.count({ where: { eventId, status: 'JOINED' } });
  }
}
