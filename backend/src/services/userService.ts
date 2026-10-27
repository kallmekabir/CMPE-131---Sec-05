import { toSelfUser } from '../domain/user';
import { toApiStatus } from '../domain/event';
import { unauthenticated } from '../errors/AppError';
import type { EventRepository } from '../repositories/eventRepository';
import type { ParticipationRepository } from '../repositories/participationRepository';
import type { UserRepository } from '../repositories/userRepository';
import type { EventCardBuilder } from './eventCards';

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly events: EventRepository,
    private readonly participations: ParticipationRepository,
    private readonly cards: EventCardBuilder,
  ) {}

  async getProfile(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw unauthenticated();
    return toSelfUser(user);
  }

  async updateProfile(
    userId: string,
    input: {
      name?: string;
      displayName?: string;
      major?: string | null;
      interests?: string[];
      skills?: string[];
    },
  ) {
    return toSelfUser(await this.users.update(userId, input));
  }

  async myEvents(userId: string, limit: number) {
    const [mine, rows] = await Promise.all([
      this.events.findMany({ organizerId: userId, deletedAt: null }, limit),
      this.participations.listForUser(userId, ['JOINED', 'WAITLISTED'], limit),
    ]);
    const attendingEvents = (
      await Promise.all(rows.map((p) => this.events.findMany({ id: p.eventId }, 1)))
    ).flat();
    return {
      organizing: await this.cards.build(mine, userId),
      attending: await this.cards.build(attendingEvents, userId),
    };
  }

  async myParticipation(userId: string, limit: number) {
    const rows = await this.participations.listForUser(
      userId,
      ['JOINED', 'WAITLISTED', 'PASSED', 'LEFT'],
      limit,
    );
    const events = (
      await Promise.all(rows.map((p) => this.events.findMany({ id: p.eventId }, 1)))
    ).flat();
    const byId = new Map(events.map((e) => [e.id, e]));
    const cards = new Map((await this.cards.build(events, userId)).map((c) => [c.id, c]));
    return rows.flatMap((p) => {
      const card = cards.get(p.eventId);
      return byId.has(p.eventId) && card
        ? [{ status: toApiStatus(p.status), waitlistPosition: card.waitlistPosition, event: card }]
        : [];
    });
  }
}
