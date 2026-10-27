import type { EventCard } from './event';

export interface RecommendationProfile {
  major: string | null;
  interests: string[];
  skills: string[];
}

export function scoreEvent(event: Pick<EventCard, 'tags'>, profile: RecommendationProfile): number {
  const tags = new Set(event.tags.map((t) => t.toLowerCase()));
  let score = 0;
  for (const i of profile.interests) if (tags.has(i.toLowerCase())) score += 2;
  for (const s of profile.skills) if (tags.has(s.toLowerCase())) score += 1;
  if (profile.major && tags.has(profile.major.toLowerCase())) score += 1;
  return score;
}

export function rankEvents<T extends Pick<EventCard, 'tags' | 'startsAt' | 'id'>>(
  events: T[],
  profile: RecommendationProfile,
  limit: number,
) {
  return events
    .map((event) => ({ event, score: scoreEvent(event, profile) }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.event.startsAt.getTime() - b.event.startsAt.getTime() ||
        a.event.id.localeCompare(b.event.id),
    )
    .slice(0, limit);
}
