import type { AuthContext } from '../domain/auth';
import { decideJoin } from '../domain/capacity';
import {
  isEventOpen,
  toApiStatus,
  type ApiParticipationStatus,
  type EventCard,
} from '../domain/event';
import { conflict, eventFull, eventUnavailable, notFound } from '../errors/AppError';
import { EventRepository } from '../repositories/eventRepository';
import {
  joinedCountIn,
  promoteWaitlist,
  waitlistPositionIn,
  type ParticipationRepository,
} from '../repositories/participationRepository';
import type { EventService } from './eventService';

export interface ParticipationResult {
  eventId: string;
  status: ApiParticipationStatus;
  waitlistPosition: number | null;
  joinedCount: number;
  alreadyApplied: boolean;
  nextEvent?: EventCard | null;
}

export class ParticipationService {
  constructor(
    private readonly events: EventRepository,
    private readonly participations: ParticipationRepository,
    private readonly eventService: EventService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async join(auth: AuthContext, eventId: string): Promise<ParticipationResult> {
    const result = await this.events.transaction(async (tx) => {
      const event = await EventRepository.lock(tx, eventId);
      if (!event || event.deletedAt) throw notFound('Event');
      if (!isEventOpen(event, this.now())) throw eventUnavailable();

      const existing = await tx.participation.findUnique({
        where: { userId_eventId: { userId: auth.userId, eventId } },
      });
      const joinedCount = await joinedCountIn(tx, eventId);
      const decision = decideJoin({
        existing: existing?.status ?? null,
        capacity: event.capacity,
        joinedCount,
        waitlistEnabled: event.waitlistEnabled,
      });

      switch (decision.action) {
        case 'return-existing': {
          const position =
            decision.status === 'WAITLISTED' && existing
              ? await waitlistPositionIn(tx, eventId, existing)
              : null;
          return this.result(eventId, decision.status, position, joinedCount, true);
        }
        case 'join': {
          await tx.participation.upsert({
            where: { userId_eventId: { userId: auth.userId, eventId } },
            create: { userId: auth.userId, eventId, status: 'JOINED' },
            update: { status: 'JOINED', queuedAt: null },
          });
          return this.result(eventId, 'JOINED', null, joinedCount + 1, false);
        }
        case 'waitlist': {
          const row = await tx.participation.upsert({
            where: { userId_eventId: { userId: auth.userId, eventId } },
            create: { userId: auth.userId, eventId, status: 'WAITLISTED', queuedAt: new Date() },
            update: { status: 'WAITLISTED', queuedAt: new Date() },
          });
          const position = await waitlistPositionIn(tx, eventId, row);
          return this.result(eventId, 'WAITLISTED', position, joinedCount, false);
        }
        case 'full':
          throw eventFull();
      }
    });
    return { ...result, nextEvent: await this.eventService.nextEligible(auth.userId, eventId) };
  }

  async leave(auth: AuthContext, eventId: string): Promise<ParticipationResult> {
    return this.events.transaction(async (tx) => {
      const event = await EventRepository.lock(tx, eventId);
      if (!event || event.deletedAt) throw notFound('Event');
      const existing = await tx.participation.findUnique({
        where: { userId_eventId: { userId: auth.userId, eventId } },
      });
      if (!existing) throw notFound('Participation');
      if (existing.status === 'LEFT') {
        return this.result(eventId, 'LEFT', null, await joinedCountIn(tx, eventId), true);
      }
      if (existing.status === 'PASSED') throw conflict('You are not participating in this event.');

      await tx.participation.update({
        where: { id: existing.id },
        data: { status: 'LEFT', queuedAt: null },
      });
      if (existing.status === 'JOINED') await promoteWaitlist(tx, event);
      return this.result(eventId, 'LEFT', null, await joinedCountIn(tx, eventId), false);
    });
  }

  async pass(auth: AuthContext, eventId: string): Promise<ParticipationResult> {
    const result = await this.events.transaction(async (tx) => {
      const event = await EventRepository.lock(tx, eventId);
      if (!event || event.deletedAt) throw notFound('Event');
      if (!isEventOpen(event, this.now())) throw eventUnavailable();
      const existing = await tx.participation.findUnique({
        where: { userId_eventId: { userId: auth.userId, eventId } },
      });
      const joinedCount = await joinedCountIn(tx, eventId);
      if (existing?.status === 'PASSED') {
        return this.result(eventId, 'PASSED', null, joinedCount, true);
      }
      if (existing?.status === 'JOINED' || existing?.status === 'WAITLISTED') {
        throw conflict('Leave this event before passing on it.');
      }
      await tx.participation.upsert({
        where: { userId_eventId: { userId: auth.userId, eventId } },
        create: { userId: auth.userId, eventId, status: 'PASSED' },
        update: { status: 'PASSED', queuedAt: null },
      });
      return this.result(eventId, 'PASSED', null, joinedCount, false);
    });
    return { ...result, nextEvent: await this.eventService.nextEligible(auth.userId, eventId) };
  }

  async status(auth: AuthContext, eventId: string) {
    const card = await this.eventService.get(auth, eventId);
    return {
      eventId,
      status: card.viewerStatus,
      waitlistPosition: card.waitlistPosition,
      joinedCount: card.joinedCount,
      capacity: card.capacity,
      waitlistEnabled: card.waitlistEnabled,
    };
  }

  private result(
    eventId: string,
    status: 'JOINED' | 'WAITLISTED' | 'PASSED' | 'LEFT',
    waitlistPosition: number | null,
    joinedCount: number,
    alreadyApplied: boolean,
  ): ParticipationResult {
    return { eventId, status: toApiStatus(status), waitlistPosition, joinedCount, alreadyApplied };
  }
}
