import type { Event } from '@prisma/client';
import type { AuthContext } from './auth';
import { forbidden } from '../errors/AppError';

export function assertCanManageEvent(auth: AuthContext, event: Pick<Event, 'organizerId'>) {
  if (auth.role !== 'ORGANIZER' || event.organizerId !== auth.userId) {
    throw forbidden('Only the organizer who owns this event can modify it.');
  }
}
