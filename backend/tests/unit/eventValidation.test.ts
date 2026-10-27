import { createEventSchema, rescheduleSchema, updateEventSchema } from '../../src/validators/event';

const valid = {
  title: 'Study Group',
  description: 'Bring your laptop.',
  startsAt: '2030-01-01T10:00:00Z',
  location: 'MLK Library',
};

const fieldsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((i) => i.path.join('.')) ?? [];

describe('createEventSchema', () => {
  it('accepts a minimal event and applies defaults', () => {
    const parsed = createEventSchema.parse(valid);
    expect(parsed.waitlistEnabled).toBe(false);
    expect(parsed.tags).toEqual([]);
    expect(parsed.startsAt).toBeInstanceOf(Date);
  });

  it.each([
    ['title', { title: '' }],
    ['title', { title: 'x'.repeat(121) }],
    ['title', { title: '<script>' }],
    ['description', { description: '' }],
    ['startsAt', { startsAt: 'tomorrow' }],
    ['startsAt', { startsAt: '2030-01-01' }],
    ['location', { location: '' }],
    ['capacity', { capacity: -1 }],
    ['capacity', { capacity: 1.5 }],
    ['capacity', { capacity: '5' }],
    ['imageUrl', { imageUrl: 'http://insecure.example/x.png' }],
    ['imageUrl', { imageUrl: 'javascript:alert(1)' }],
    ['tags', { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
  ])('rejects invalid %s', (field, patch) => {
    const result = createEventSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(fieldsOf(result)).toContain(field);
  });

  it('rejects an end time before the start time on endsAt', () => {
    const result = createEventSchema.safeParse({ ...valid, endsAt: '2029-12-31T10:00:00Z' });
    expect(fieldsOf(result)).toContain('endsAt');
  });

  it('allows end equal to start and capacity zero', () => {
    expect(
      createEventSchema.safeParse({ ...valid, endsAt: valid.startsAt, capacity: 0 }).success,
    ).toBe(true);
  });

  it('rejects unknown fields such as organizerId', () => {
    expect(createEventSchema.safeParse({ ...valid, organizerId: 'x' }).success).toBe(false);
  });

  it('normalizes and de-duplicates tags', () => {
    expect(createEventSchema.parse({ ...valid, tags: ['Food', 'food', ' Music '] }).tags).toEqual([
      'food',
      'music',
    ]);
  });

  it('rejects control characters', () => {
    expect(createEventSchema.safeParse({ ...valid, description: 'bad\u0000text' }).success).toBe(
      false,
    );
  });
});

describe('updateEventSchema / rescheduleSchema', () => {
  it('rejects an empty update', () => {
    expect(updateEventSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a partial update', () => {
    expect(updateEventSchema.safeParse({ capacity: null }).success).toBe(true);
  });

  it('requires startsAt for reschedule', () => {
    expect(rescheduleSchema.safeParse({}).success).toBe(false);
  });
});
