import type { Participation } from '@prisma/client';
import type { EventCard, ViewerStatus } from '../domain/event';
import { toApiStatus } from '../domain/event';
import type { EventRepository, EventWithOrganizer } from '../repositories/eventRepository';
import type { ParticipationRepository } from '../repositories/participationRepository';

export class EventCardBuilder {
  constructor(
    private readonly events: EventRepository,
    private readonly participations: ParticipationRepository,
  ) {}

  async build(events: EventWithOrganizer[], viewerId: string): Promise<EventCard[]> {
    const ids = events.map((e) => e.id);
    const [counts, mine] = await Promise.all([
      this.events.joinedCounts(ids),
      this.participations.viewerStatuses(viewerId, ids),
    ]);
    return Promise.all(
      events.map(async (e) => {
        const joinedCount = counts.get(e.id) ?? 0;
        const p = mine.get(e.id);
        const isFull = e.capacity !== null && joinedCount >= e.capacity;
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          location: e.location,
          capacity: e.capacity,
          waitlistEnabled: e.waitlistEnabled,
          imageUrl: e.imageUrl,
          tags: e.tags,
          status: e.status,
          organizer: e.organizer,
          joinedCount,
          spotsLeft: e.capacity === null ? null : Math.max(0, e.capacity - joinedCount),
          viewerStatus: await this.viewerStatus(p, isFull),
          waitlistPosition:
            p?.status === 'WAITLISTED' ? await this.participations.waitlistPosition(e.id, p) : null,
        };
      }),
    );
  }

  private async viewerStatus(p: Participation | undefined, isFull: boolean): Promise<ViewerStatus> {
    if (p && p.status !== 'LEFT') return toApiStatus(p.status);
    if (p?.status === 'LEFT') return isFull ? 'full' : 'left';
    return isFull ? 'full' : 'none';
  }
}
