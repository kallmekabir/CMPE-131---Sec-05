import type { Prisma } from '@prisma/client';
import type { Db } from '../db/client';

export const eventWithOrganizer = {
  organizer: { select: { id: true, displayName: true, major: true } },
} satisfies Prisma.EventInclude;

export type EventWithOrganizer = Prisma.EventGetPayload<{ include: typeof eventWithOrganizer }>;

export interface LockedEvent {
  id: string;
  capacity: number | null;
  waitlistEnabled: boolean;
  status: 'ACTIVE' | 'CANCELLED';
  deletedAt: Date | null;
  startsAt: Date;
  endsAt: Date | null;
}

export class EventRepository {
  constructor(private readonly db: Db) {}

  create(data: Prisma.EventUncheckedCreateInput): Promise<EventWithOrganizer> {
    return this.db.event.create({ data, include: eventWithOrganizer });
  }

  findVisibleById(id: string) {
    return this.db.event.findFirst({
      where: { id, deletedAt: null },
      include: eventWithOrganizer,
    });
  }

  async list(where: Prisma.EventWhereInput, skip: number, take: number) {
    const [items, total] = await this.db.$transaction([
      this.db.event.findMany({
        where,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip,
        take,
        include: eventWithOrganizer,
      }),
      this.db.event.count({ where }),
    ]);
    return { items, total };
  }

  findMany(where: Prisma.EventWhereInput, take: number) {
    return this.db.event.findMany({
      where,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take,
      include: eventWithOrganizer,
    });
  }

  async joinedCounts(eventIds: string[]): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.db.participation.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds }, status: 'JOINED' },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.eventId, r._count._all]));
  }

  softDelete(id: string) {
    return this.db.event.update({
      where: { id },
      data: { status: 'CANCELLED', deletedAt: new Date() },
    });
  }

  static async lock(tx: Prisma.TransactionClient, eventId: string): Promise<LockedEvent | null> {
    const rows = await tx.$queryRaw<
      {
        event_id: string;
        capacity: number | null;
        waitlist_enabled: boolean;
        status: 'ACTIVE' | 'CANCELLED';
        deleted_at: Date | null;
        starts_at: Date;
        ends_at: Date | null;
      }[]
    >`SELECT event_id, capacity, waitlist_enabled, status, deleted_at, starts_at, ends_at
      FROM events WHERE event_id = ${eventId}::uuid FOR UPDATE`;
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.event_id,
      capacity: r.capacity,
      waitlistEnabled: r.waitlist_enabled,
      status: r.status,
      deletedAt: r.deleted_at,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
    };
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }
}
