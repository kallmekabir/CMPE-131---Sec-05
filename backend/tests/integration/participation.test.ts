import request from 'supertest';
import { actor, buildTestApp, createEvent, resetDatabase } from '../helpers/testApp';

const t = buildTestApp();
const api = () => request(t.app);
beforeEach(() => resetDatabase(t.db));
afterAll(() => t.db.$disconnect());

const join = (eventId: string, headers: Record<string, string>) =>
  api().post(`/api/events/${eventId}/join`).set(headers);
const leave = (eventId: string, headers: Record<string, string>) =>
  api().post(`/api/events/${eventId}/leave`).set(headers);
const status = async (eventId: string, headers: Record<string, string>) =>
  (await api().get(`/api/events/${eventId}/status`).set(headers)).body.data;

async function setup(opts: { capacity?: number | null; waitlistEnabled?: boolean } = {}) {
  const org = await actor(t.db, 'ORGANIZER');
  const event = await createEvent(t.db, org.user.id, opts);
  return { org, event };
}

describe('join', () => {
  it('joins under capacity', async () => {
    const { event } = await setup({ capacity: 3 });
    const p = await actor(t.db);
    const res = await join(event.id, p.headers);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'joined',
      joinedCount: 1,
      waitlistPosition: null,
    });
  });

  it('joins exactly at the capacity boundary, then reports full', async () => {
    const { event } = await setup({ capacity: 2 });
    const [a, b, c] = [await actor(t.db), await actor(t.db), await actor(t.db)];
    expect((await join(event.id, a.headers)).body.data.status).toBe('joined');
    expect((await join(event.id, b.headers)).body.data).toMatchObject({
      status: 'joined',
      joinedCount: 2,
    });
    const full = await join(event.id, c.headers);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('EVENT_FULL');
    expect((await status(event.id, c.headers)).status).toBe('full');
    expect(await t.db.participation.count({ where: { eventId: event.id, status: 'JOINED' } })).toBe(
      2,
    );
    expect(await t.db.participation.count({ where: { userId: c.user.id } })).toBe(0);
  });

  it('waitlists with a position when full and the waitlist is enabled', async () => {
    const { event } = await setup({ capacity: 1, waitlistEnabled: true });
    const [a, b, c] = [await actor(t.db), await actor(t.db), await actor(t.db)];
    await join(event.id, a.headers);
    expect((await join(event.id, b.headers)).body.data).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 1,
    });
    expect((await join(event.id, c.headers)).body.data).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 2,
    });
  });

  it('supports unlimited capacity and capacity zero', async () => {
    const unlimited = await setup({ capacity: null });
    for (let i = 0; i < 3; i++) await join(unlimited.event.id, (await actor(t.db)).headers);
    expect(
      await t.db.participation.count({ where: { eventId: unlimited.event.id, status: 'JOINED' } }),
    ).toBe(3);

    const zero = await setup({ capacity: 0 });
    expect((await join(zero.event.id, (await actor(t.db)).headers)).body.error.code).toBe(
      'EVENT_FULL',
    );
  });

  it('is idempotent for repeated joins and repeated waitlisting', async () => {
    const { event } = await setup({ capacity: 1, waitlistEnabled: true });
    const [a, b] = [await actor(t.db), await actor(t.db)];
    await join(event.id, a.headers);
    const again = await join(event.id, a.headers);
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ status: 'joined', alreadyApplied: true });
    await join(event.id, b.headers);
    const bAgain = await join(event.id, b.headers);
    expect(bAgain.body.data).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 1,
      alreadyApplied: true,
    });
    expect(await t.db.participation.count({ where: { eventId: event.id } })).toBe(2);
  });

  it('rejects unavailable events (cancelled, deleted, finished) and unknown ids', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const cancelled = await createEvent(t.db, org.user.id, { status: 'CANCELLED' });
    const past = await createEvent(t.db, org.user.id, {
      startsAt: new Date(Date.now() - 86400000),
    });
    const deleted = await createEvent(t.db, org.user.id, {
      deletedAt: new Date(),
      status: 'CANCELLED',
    });
    expect((await join(cancelled.id, p.headers)).body.error.code).toBe('EVENT_UNAVAILABLE');
    expect((await join(past.id, p.headers)).body.error.code).toBe('EVENT_UNAVAILABLE');
    expect((await join(deleted.id, p.headers)).status).toBe(404);
    expect((await join('00000000-0000-4000-8000-000000000000', p.headers)).status).toBe(404);
    expect((await join('nope', p.headers)).status).toBe(400);
  });

  it('requires authentication', async () => {
    const { event } = await setup();
    expect((await api().post(`/api/events/${event.id}/join`)).status).toBe(401);
  });
});

describe('concurrency', () => {
  it('never exceeds capacity when many users join at once', async () => {
    const { event } = await setup({ capacity: 5, waitlistEnabled: false });
    const users = await Promise.all(Array.from({ length: 25 }, () => actor(t.db)));
    const results = await Promise.all(users.map((u) => join(event.id, u.headers)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect(results.filter((r) => r.status === 409)).toHaveLength(20);
    expect(await t.db.participation.count({ where: { eventId: event.id, status: 'JOINED' } })).toBe(
      5,
    );
  });

  it('assigns distinct, gap-free waitlist positions under concurrency', async () => {
    const { event } = await setup({ capacity: 2, waitlistEnabled: true });
    const users = await Promise.all(Array.from({ length: 12 }, () => actor(t.db)));
    const results = await Promise.all(users.map((u) => join(event.id, u.headers)));
    const joined = results.filter((r) => r.body.data.status === 'joined');
    const positions = results
      .filter((r) => r.body.data.status === 'waitlisted')
      .map((r) => r.body.data.waitlistPosition as number)
      .sort((x, y) => x - y);
    expect(joined).toHaveLength(2);
    expect(positions).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it('creates exactly one row when the same user fires many joins at once', async () => {
    const { event } = await setup({ capacity: 5 });
    const p = await actor(t.db);
    const results = await Promise.all(Array.from({ length: 10 }, () => join(event.id, p.headers)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(
      await t.db.participation.count({ where: { userId: p.user.id, eventId: event.id } }),
    ).toBe(1);
  });

  it('keeps counts consistent with concurrent joins and leaves', async () => {
    const { event } = await setup({ capacity: 3, waitlistEnabled: true });
    const users = await Promise.all(Array.from({ length: 10 }, () => actor(t.db)));
    await Promise.all(users.map((u) => join(event.id, u.headers)));
    await Promise.all(users.slice(0, 4).map((u) => leave(event.id, u.headers)));
    const joined = await t.db.participation.count({
      where: { eventId: event.id, status: 'JOINED' },
    });
    expect(joined).toBeLessThanOrEqual(3);
    expect(joined).toBe(3);
  });
});

describe('leave and promotion', () => {
  it('promotes the earliest waitlisted user when a joined user leaves', async () => {
    const { event } = await setup({ capacity: 1, waitlistEnabled: true });
    const [a, b, c] = [await actor(t.db), await actor(t.db), await actor(t.db)];
    await join(event.id, a.headers);
    await join(event.id, b.headers);
    await join(event.id, c.headers);

    const res = await leave(event.id, a.headers);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'left', joinedCount: 1 });
    expect(await status(event.id, b.headers)).toMatchObject({
      status: 'joined',
      waitlistPosition: null,
    });
    expect(await status(event.id, c.headers)).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 1,
    });
  });

  it('does not promote when a waitlisted user leaves', async () => {
    const { event } = await setup({ capacity: 1, waitlistEnabled: true });
    const [a, b, c] = [await actor(t.db), await actor(t.db), await actor(t.db)];
    await join(event.id, a.headers);
    await join(event.id, b.headers);
    await join(event.id, c.headers);
    await leave(event.id, b.headers);
    expect(await status(event.id, a.headers)).toMatchObject({ status: 'joined' });
    expect(await status(event.id, c.headers)).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 1,
    });
  });

  it('frees the spot for new joiners when there is no waitlist', async () => {
    const { event } = await setup({ capacity: 1 });
    const [a, b] = [await actor(t.db), await actor(t.db)];
    await join(event.id, a.headers);
    await leave(event.id, a.headers);
    expect((await join(event.id, b.headers)).body.data.status).toBe('joined');
  });

  it('is idempotent when leaving twice and 404s with no participation', async () => {
    const { event } = await setup();
    const p = await actor(t.db);
    expect((await leave(event.id, p.headers)).status).toBe(404);
    await join(event.id, p.headers);
    expect((await leave(event.id, p.headers)).body.data).toMatchObject({
      status: 'left',
      alreadyApplied: false,
    });
    expect((await leave(event.id, p.headers)).body.data).toMatchObject({
      status: 'left',
      alreadyApplied: true,
    });
  });

  it('lets a user who left rejoin', async () => {
    const { event } = await setup();
    const p = await actor(t.db);
    await join(event.id, p.headers);
    await leave(event.id, p.headers);
    expect((await join(event.id, p.headers)).body.data.status).toBe('joined');
    expect(await t.db.participation.count({ where: { userId: p.user.id } })).toBe(1);
  });

  it('promotes in queue order even if the earliest waitlister later re-queues', async () => {
    const { event } = await setup({ capacity: 1, waitlistEnabled: true });
    const [a, b, c] = [await actor(t.db), await actor(t.db), await actor(t.db)];
    await join(event.id, a.headers);
    await join(event.id, b.headers);
    await leave(event.id, b.headers);
    await join(event.id, c.headers);
    await join(event.id, b.headers);
    await leave(event.id, a.headers);
    expect((await status(event.id, c.headers)).status).toBe('joined');
    expect(await status(event.id, b.headers)).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 1,
    });
  });
});

describe('pass', () => {
  it('stores a pass, is idempotent, and returns the next event', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const first = await createEvent(t.db, org.user.id, {
      startsAt: new Date(Date.now() + 3600000),
    });
    const second = await createEvent(t.db, org.user.id, {
      startsAt: new Date(Date.now() + 7200000),
    });
    const p = await actor(t.db);
    const res = await api().post(`/api/events/${first.id}/pass`).set(p.headers);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'passed', nextEvent: { id: second.id } });
    const again = await api().post(`/api/events/${first.id}/pass`).set(p.headers);
    expect(again.body.data.alreadyApplied).toBe(true);
    expect(await t.db.participation.count({ where: { userId: p.user.id } })).toBe(1);
  });

  it('returns a null nextEvent when nothing else is eligible', async () => {
    const { event } = await setup();
    const p = await actor(t.db);
    expect(
      (await api().post(`/api/events/${event.id}/pass`).set(p.headers)).body.data.nextEvent,
    ).toBeNull();
  });

  it('conflicts when already joined, allows joining after a pass, and handles bad ids', async () => {
    const { event } = await setup();
    const p = await actor(t.db);
    await join(event.id, p.headers);
    expect((await api().post(`/api/events/${event.id}/pass`).set(p.headers)).status).toBe(409);
    const q = await actor(t.db);
    await api().post(`/api/events/${event.id}/pass`).set(q.headers);
    expect((await join(event.id, q.headers)).body.data.status).toBe('joined');
    expect(
      (await api().post('/api/events/00000000-0000-4000-8000-000000000000/pass').set(q.headers))
        .status,
    ).toBe(404);
    expect((await api().post(`/api/events/${event.id}/pass`)).status).toBe(401);
  });

  it('conflicts when leaving after a pass', async () => {
    const { event } = await setup();
    const p = await actor(t.db);
    await api().post(`/api/events/${event.id}/pass`).set(p.headers);
    expect((await leave(event.id, p.headers)).status).toBe(409);
  });
});

describe('isolation between users', () => {
  it("never lets one user's request change another user's participation", async () => {
    const { event } = await setup({ capacity: 5 });
    const [a, b] = [await actor(t.db), await actor(t.db)];
    await join(event.id, a.headers);
    await leave(event.id, b.headers);
    expect(await status(event.id, a.headers)).toMatchObject({ status: 'joined' });
    const res = await api()
      .post(`/api/events/${event.id}/leave`)
      .set(b.headers)
      .send({ userId: a.user.id });
    expect(res.status).toBe(404);
    expect(await status(event.id, a.headers)).toMatchObject({ status: 'joined' });
  });
});

describe('GET /api/events/:eventId/status', () => {
  it('reports none, then joined; 404s for unknown events; requires auth', async () => {
    const { event } = await setup();
    const p = await actor(t.db);
    expect((await status(event.id, p.headers)).status).toBe('none');
    await join(event.id, p.headers);
    expect((await status(event.id, p.headers)).status).toBe('joined');
    expect(
      (await api().get('/api/events/00000000-0000-4000-8000-000000000000/status').set(p.headers))
        .status,
    ).toBe(404);
    expect((await api().get(`/api/events/${event.id}/status`)).status).toBe(401);
  });
});
