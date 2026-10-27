import type { AuthContext } from '../domain/auth';
import { rankEvents } from '../domain/recommendation';
import { dependencyUnavailable } from '../errors/AppError';
import type { Logger } from '../logging/logger';
import type { CalendarAdapter } from '../adapters/calendar/CalendarAdapter';
import type { MapAdapter } from '../adapters/maps/MapAdapter';
import type { SharingAdapter } from '../adapters/sharing/SharingAdapter';
import type { UserRepository } from '../repositories/userRepository';
import type { EventService } from './eventService';

export interface IntegrationAdapters {
  maps: MapAdapter;
  calendar: CalendarAdapter;
  sharing: SharingAdapter;
}

export class IntegrationService {
  constructor(
    private readonly events: EventService,
    private readonly users: UserRepository,
    private readonly adapters: IntegrationAdapters,
    private readonly logger: Logger,
  ) {}

  /** Map outages degrade to the plain-text location; they never fail the request. */
  async map(auth: AuthContext, eventId: string) {
    const event = await this.events.get(auth, eventId);
    try {
      const links = await this.adapters.maps.getLinks(event.location);
      return { available: true, location: event.location, ...links };
    } catch (err) {
      this.logger.warn({ eventId, err: (err as Error).message }, 'map adapter failed');
      return { available: false, location: event.location, mapUrl: null, navigationUrl: null };
    }
  }

  async navigation(auth: AuthContext, eventId: string) {
    const { available, location, navigationUrl } = await this.map(auth, eventId);
    return { available, location, navigationUrl };
  }

  async share(auth: AuthContext, eventId: string) {
    const event = await this.events.get(auth, eventId);
    try {
      return await this.adapters.sharing.createLinks(event.id);
    } catch (err) {
      this.logger.warn({ eventId, err: (err as Error).message }, 'sharing adapter failed');
      throw dependencyUnavailable('Sharing service');
    }
  }

  async calendar(auth: AuthContext, eventId: string) {
    const event = await this.events.get(auth, eventId);
    try {
      return await this.adapters.calendar.create(event);
    } catch (err) {
      this.logger.warn({ eventId, err: (err as Error).message }, 'calendar adapter failed');
      throw dependencyUnavailable('Calendar service');
    }
  }

  async recommendations(auth: AuthContext, limit: number) {
    const user = await this.users.findById(auth.userId);
    if (!user) return [];
    const feed = await this.events.list(auth, { feed: true, page: 1, limit: 50 });
    return rankEvents(feed.items, user, limit).map((r) => ({ score: r.score, event: r.event }));
  }
}
