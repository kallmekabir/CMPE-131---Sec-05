import { decideJoin, hasOpenSpot, openSpots } from '../../src/domain/capacity';

describe('capacity helpers', () => {
  it.each([
    [null, 1000, true],
    [5, 4, true],
    [5, 5, false],
    [0, 0, false],
  ])('hasOpenSpot(capacity=%s, joined=%s) -> %s', (capacity, joined, expected) => {
    expect(hasOpenSpot(capacity, joined)).toBe(expected);
  });

  it('computes open spots and never goes negative', () => {
    expect(openSpots(5, 3)).toBe(2);
    expect(openSpots(5, 9)).toBe(0);
    expect(openSpots(null, 9)).toBe(Infinity);
  });
});

describe('decideJoin', () => {
  const base = { existing: null, capacity: 2, joinedCount: 0, waitlistEnabled: false } as const;

  it('joins under capacity', () => {
    expect(decideJoin({ ...base, joinedCount: 1 })).toEqual({ action: 'join' });
  });

  it('joins when capacity is unlimited', () => {
    expect(decideJoin({ ...base, capacity: null, joinedCount: 9999 })).toEqual({ action: 'join' });
  });

  it('takes the last spot exactly at the boundary (capacity-1 joined)', () => {
    expect(decideJoin({ ...base, capacity: 3, joinedCount: 2 })).toEqual({ action: 'join' });
  });

  it('waitlists when full and the waitlist is enabled', () => {
    expect(decideJoin({ ...base, joinedCount: 2, waitlistEnabled: true })).toEqual({
      action: 'waitlist',
    });
  });

  it('reports full when full and the waitlist is disabled', () => {
    expect(decideJoin({ ...base, joinedCount: 2 })).toEqual({ action: 'full' });
  });

  it('treats capacity 0 as always full', () => {
    expect(decideJoin({ ...base, capacity: 0 })).toEqual({ action: 'full' });
    expect(decideJoin({ ...base, capacity: 0, waitlistEnabled: true })).toEqual({
      action: 'waitlist',
    });
  });

  it.each(['JOINED', 'WAITLISTED'] as const)('is idempotent for existing %s', (existing) => {
    expect(decideJoin({ ...base, existing, joinedCount: 2 })).toEqual({
      action: 'return-existing',
      status: existing,
    });
  });

  it.each(['LEFT', 'PASSED'] as const)('lets a %s user try again', (existing) => {
    expect(decideJoin({ ...base, existing })).toEqual({ action: 'join' });
  });
});
