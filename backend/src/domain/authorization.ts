import type { Event } from '@prisma/client';
import type { AuthContext } from './auth';
import { forbidden } from '../errors/AppError';

/** Any verified user may host events (PRD 4.1); only the event's owner may manage it. */
export function assertCanManageEvent(auth: AuthContext, event: Pick<Event, 'organizerId'>) {
  if (event.organizerId !== auth.userId) {
    throw forbidden('Only the person who created this event can modify it.');
  }
}
