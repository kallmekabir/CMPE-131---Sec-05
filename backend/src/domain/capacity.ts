import type { ParticipationStatus } from '@prisma/client';

export type JoinDecision =
  | { action: 'return-existing'; status: 'JOINED' | 'WAITLISTED' }
  | { action: 'join' }
  | { action: 'waitlist' }
  | { action: 'full' };

export const hasOpenSpot = (capacity: number | null, joinedCount: number) =>
  capacity === null || joinedCount < capacity;

export const openSpots = (capacity: number | null, joinedCount: number) =>
  capacity === null ? Number.POSITIVE_INFINITY : Math.max(0, capacity - joinedCount);

export function decideJoin(input: {
  existing: ParticipationStatus | null;
  capacity: number | null;
  joinedCount: number;
  waitlistEnabled: boolean;
}): JoinDecision {
  if (input.existing === 'JOINED' || input.existing === 'WAITLISTED') {
    return { action: 'return-existing', status: input.existing };
  }
  if (hasOpenSpot(input.capacity, input.joinedCount)) return { action: 'join' };
  return input.waitlistEnabled ? { action: 'waitlist' } : { action: 'full' };
}
