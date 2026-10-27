import { rankEvents, scoreEvent } from '../../src/domain/recommendation';

const profile = { major: 'Computer Science', interests: ['Music', 'hiking'], skills: ['react'] };
const ev = (id: string, tags: string[], day: number) => ({
  id,
  tags,
  startsAt: new Date(2030, 0, day),
});

describe('recommendations', () => {
  it('weights interests above skills above major, case-insensitively', () => {
    expect(scoreEvent({ tags: ['music'] }, profile)).toBe(2);
    expect(scoreEvent({ tags: ['REACT'] }, profile)).toBe(1);
    expect(scoreEvent({ tags: ['computer science'] }, profile)).toBe(1);
    expect(scoreEvent({ tags: ['music', 'hiking', 'react'] }, profile)).toBe(5);
  });

  it('drops zero-score events and orders by score, then date, then id', () => {
    const events = [
      ev('b', ['music'], 2),
      ev('a', ['music'], 2),
      ev('c', ['hiking', 'music'], 5),
      ev('z', ['other'], 1),
    ];
    expect(rankEvents(events, profile, 10).map((r) => r.event.id)).toEqual(['c', 'a', 'b']);
  });

  it('respects the limit and handles empty profiles', () => {
    expect(rankEvents([ev('a', ['music'], 1), ev('b', ['music'], 2)], profile, 1)).toHaveLength(1);
    expect(
      rankEvents([ev('a', ['music'], 1)], { major: null, interests: [], skills: [] }, 5),
    ).toEqual([]);
  });
});
