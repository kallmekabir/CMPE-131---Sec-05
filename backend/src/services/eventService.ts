import type { Prisma } from '@prisma/client';
import type { AuthContext } from '../domain/auth';
import { assertCanManageEvent } from '../domain/authorization';
import { toPublicUser } from '../domain/user';
import { toApiStatus } from '../domain/event';
import { conflict, notFound, validationError } from '../errors/AppError';
import { EventRepository } from '../repositories/eventRepository';
import {
  joinedCountIn,
  promoteWaitlist,
  type ParticipationRepository,
} from '../repositories/participationRepository';
import type { EventCardBuilder } from './eventCards';

export interface CreateEventInput {
  title: string;
  description: string;
  startsAt: Date;
  endsAt?: Date | null;
  location: string;
  capacity?: number | null;
  waitlistEnabled: boolean;
  imageUrl?: string | null;
  tags: string[];
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'waitlistEnabled'>> & {
  waitlistEnabled?: boolean;
};

export interface ListEventsQuery {
  q?: string;
  tag?: string;
  from?: Date;
  to?: Date;
  feed?: boolean;
  includePassed?: boolean;
  page: number;
  limit: number;
}

const fieldError = (field: string, message: string) =>
  validationError({ fields: { [field]: [message] } });

export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly participations: ParticipationRepository,
    private readonly cards: EventCardBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(auth: AuthContext, input: CreateEventInput) {
    if (input.startsAt <= this.now()) throw fieldError('startsAt', 'Must be in the future');
    const event = await this.events.create({
      organizerId: auth.userId,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      location: input.location,
      capacity: input.capacity ?? null,
      waitlistEnabled: input.waitlistEnabled,
      imageUrl: input.imageUrl ?? null,
      tags: input.tags,
    });
    return (await this.cards.build([event], auth.userId))[0]!;
  }

  async get(auth: AuthContext, eventId: string) {
    const event = await this.events.findVisibleById(eventId);
    if (!event) throw notFound('Event');
    return (await this.cards.build([event], auth.userId))[0]!;
  }

  availableWhere(): Prisma.EventWhereInput {
    const now = this.now();
    return {
      status: 'ACTIVE',
      deletedAt: null,
      OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }],
    };
  }

  async list(auth: AuthContext, query: ListEventsQuery) {
    const excluded = query.feed
      ? ['PASSED', 'JOINED', 'WAITLISTED']
      : query.includePassed
        ? []
        : ['PASSED'];
    const where: Prisma.EventWhereInput = {
      AND: [
        this.availableWhere(),
        query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {},
        query.tag ? { tags: { has: query.tag } } : {},
        query.from ? { startsAt: { gte: query.from } } : {},
        query.to ? { startsAt: { lte: query.to } } : {},
        excluded.length
          ? {
              participations: {
                none: {
                  userId: auth.userId,
                  status: { in: excluded as ('PASSED' | 'JOINED' | 'WAITLISTED')[] },
                },
              },
            }
          : {},
      ],
    };
    const { items, total } = await this.events.list(
      where,
      (query.page - 1) * query.limit,
      query.limit,
    );
    return {
      items: await this.cards.build(items, auth.userId),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    };
  }

  async nextEligible(userId: string, excludeEventId: string) {
    const [event] = await this.events.findMany(
      {
        AND: [
          this.availableWhere(),
          { id: { not: excludeEventId } },
          {
            participations: {
              none: { userId, status: { in: ['PASSED', 'JOINED', 'WAITLISTED'] } },
            },
          },
        ],
      },
      1,
    );
    return event ? (await this.cards.build([event], userId))[0]! : null;
  }

  async update(auth: AuthContext, eventId: string, input: UpdateEventInput) {
    const existing = await this.events.findVisibleById(eventId);
    if (!existing) throw notFound('Event');
    assertCanManageEvent(auth, existing);

    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt;
    if (input.startsAt && input.startsAt <= this.now()) {
      throw fieldError('startsAt', 'Must be in the future');
    }
    if (endsAt && endsAt < startsAt)
      throw fieldError('endsAt', 'endsAt must not be before startsAt');

    await this.events.transaction(async (tx) => {
      const locked = await EventRepository.lock(tx, eventId);
      if (!locked || locked.deletedAt) throw notFound('Event');
      const capacity = input.capacity === undefined ? locked.capacity : input.capacity;
      if (capacity !== null && (await joinedCountIn(tx, eventId)) > capacity) {
        throw conflict('Capacity cannot be lower than the number of joined participants.');
      }
      await tx.event.update({ where: { id: eventId }, data: { ...input, endsAt } });
      await promoteWaitlist(tx, { id: eventId, capacity });
    });
    return this.get(auth, eventId);
  }

  reschedule(auth: AuthContext, eventId: string, input: { startsAt: Date; endsAt?: Date | null }) {
    return this.update(auth, eventId, {
      startsAt: input.startsAt,
      endsAt: input.endsAt === undefined ? null : input.endsAt,
    });
  }

  async remove(auth: AuthContext, eventId: string) {
    const existing = await this.events.findVisibleById(eventId);
    if (!existing) throw notFound('Event');
    assertCanManageEvent(auth, existing);
    await this.events.softDelete(eventId);
  }

  async participants(auth: AuthContext, eventId: string, limit: number) {
    const event = await this.events.findVisibleById(eventId);
    if (!event) throw notFound('Event');
    assertCanManageEvent(auth, event);
    const rows = await this.participations.listForEvent(eventId, limit);
    const withPositions = await Promise.all(
      rows.map(async (p) => ({
        user: toPublicUser(p.user),
        status: toApiStatus(p.status),
        waitlistPosition:
          p.status === 'WAITLISTED' ? await this.participations.waitlistPosition(eventId, p) : null,
        joinedOrQueuedAt: p.queuedAt ?? p.createdAt,
      })),
    );
    return { items: withPositions, joinedCount: await this.participations.countByStatus(eventId) };
  }
}
