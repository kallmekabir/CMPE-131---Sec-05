import type { Event, ParticipationStatus } from '@prisma/client';
import type { PublicUser } from './user';

export type ApiParticipationStatus = 'joined' | 'waitlisted' | 'passed' | 'left';
export type ViewerStatus = ApiParticipationStatus | 'full' | 'none';

export const toApiStatus = (s: ParticipationStatus): ApiParticipationStatus =>
  s.toLowerCase() as ApiParticipationStatus;

export interface EventCard {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  capacity: number | null;
  waitlistEnabled: boolean;
  imageUrl: string | null;
  tags: string[];
  status: Event['status'];
  organizer: PublicUser;
  joinedCount: number;
  spotsLeft: number | null;
  viewerStatus: ViewerStatus;
  waitlistPosition: number | null;
}

export const isEventOpen = (
  event: Pick<Event, 'status' | 'deletedAt' | 'startsAt' | 'endsAt'>,
  now: Date,
) =>
  event.status === 'ACTIVE' && event.deletedAt === null && (event.endsAt ?? event.startsAt) >= now;
