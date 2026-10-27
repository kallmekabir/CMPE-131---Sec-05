import request from 'supertest';
import { actor, buildTestApp, createEvent, resetDatabase } from '../helpers/testApp';

const t = buildTestApp();
const api = () => request(t.app);
beforeEach(() => resetDatabase(t.db));
afterAll(() => t.db.$disconnect());

const inDays = (d: number) => new Date(Date.now() + d * 24 * 3600 * 1000).toISOString();
const payload = (over: object = {}) => ({
  title: 'Transfer Welcome Mixer',
  description: 'Meet fellow transfers.',
  startsAt: inDays(5),
  location: 'Student Union Ballroom',
  capacity: 50,
  waitlistEnabled: true,
  tags: ['Social'],
  ...over,
});

describe('POST /api/events', () => {
  it('lets an organizer create an event owned by them', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const res = await api()
      .post('/api/events')
      .set(org.headers)
      .send(payload({ organizerId: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Transfer Welcome Mixer',
      tags: ['social'],
      joinedCount: 0,
    });
    expect(res.body.data.organizer.id).toBe(org.user.id);
    expect(res.body.data.organizer).not.toHaveProperty('universityEmail');
  });

  it('forbids participants and requires authentication', async () => {
    const p = await actor(t.db);
    expect((await api().post('/api/events').set(p.headers).send(payload())).status).toBe(403);
    expect((await api().post('/api/events').send(payload())).status).toBe(401);
    expect(await t.db.event.count()).toBe(0);
  });

  it.each([
    ['title', { title: '' }],
    ['capacity', { capacity: -5 }],
    ['endsAt', { endsAt: inDays(1) }],
    ['startsAt', { startsAt: inDays(-1) }],
  ])('rejects invalid %s without creating a record', async (field, patch) => {
    const org = await actor(t.db, 'ORGANIZER');
    const res = await api().post('/api/events').set(org.headers).send(payload(patch));
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toHaveProperty(field);
    expect(await t.db.event.count()).toBe(0);
  });

  it('rejects ownership spoofing via organizerId', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const other = await actor(t.db, 'ORGANIZER');
    const res = await api()
      .post('/api/events')
      .set(org.headers)
      .send(payload({ organizerId: other.user.id }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/events', () => {
  it('lists upcoming active events, excluding cancelled, deleted and past ones', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const ok = await createEvent(t.db, org.user.id, { title: 'Visible' });
    await createEvent(t.db, org.user.id, { title: 'Cancelled', status: 'CANCELLED' });
    await createEvent(t.db, org.user.id, { title: 'Deleted', deletedAt: new Date() });
    await createEvent(t.db, org.user.id, {
      title: 'Past',
      startsAt: new Date(Date.now() - 86400000),
    });
    const res = await api().get('/api/events').set(p.headers);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((e: { id: string }) => e.id)).toEqual([ok.id]);
    expect(res.body.data).toMatchObject({ page: 1, limit: 20, total: 1, hasMore: false });
  });

  it('paginates in start-time order', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    for (let i = 1; i <= 5; i++) {
      await createEvent(t.db, org.user.id, {
        title: `E${i}`,
        startsAt: new Date(Date.now() + i * 3600000),
      });
    }
    const res = await api().get('/api/events?limit=2&page=2').set(p.headers);
    expect(res.body.data.items.map((e: { title: string }) => e.title)).toEqual(['E3', 'E4']);
    expect(res.body.data.hasMore).toBe(true);
  });

  it('filters by text and tag, treating injection strings as literals', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    await createEvent(t.db, org.user.id, { title: 'Hack Night', tags: ['tech'] });
    await createEvent(t.db, org.user.id, { title: 'Yoga', tags: ['wellness'] });
    expect((await api().get('/api/events?q=hack').set(p.headers)).body.data.total).toBe(1);
    expect((await api().get('/api/events?tag=wellness').set(p.headers)).body.data.total).toBe(1);
    const inj = await api().get("/api/events?q=' OR 1=1; DROP TABLE events;--").set(p.headers);
    expect(inj.status).toBe(200);
    expect(inj.body.data.total).toBe(0);
    expect(await t.db.event.count()).toBe(2);
  });

  it('hides passed events by default and in feed mode, and shows them on request', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const e = await createEvent(t.db, org.user.id);
    await api().post(`/api/events/${e.id}/pass`).set(p.headers);
    expect((await api().get('/api/events').set(p.headers)).body.data.total).toBe(0);
    expect((await api().get('/api/events?includePassed=true').set(p.headers)).body.data.total).toBe(
      1,
    );
  });

  it('validates query parameters and requires authentication', async () => {
    const p = await actor(t.db);
    expect((await api().get('/api/events?limit=0').set(p.headers)).status).toBe(400);
    expect((await api().get('/api/events?from=yesterday').set(p.headers)).status).toBe(400);
    expect((await api().get('/api/events')).status).toBe(401);
  });
});

describe('GET /api/events/:eventId', () => {
  it('returns event details and viewer status', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const e = await createEvent(t.db, org.user.id);
    const res = await api().get(`/api/events/${e.id}`).set(p.headers);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: e.id, viewerStatus: 'none', spotsLeft: 10 });
  });

  it('404s for unknown, deleted, and 400s for malformed ids', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const deleted = await createEvent(t.db, org.user.id, {
      deletedAt: new Date(),
      status: 'CANCELLED',
    });
    expect(
      (await api().get('/api/events/00000000-0000-4000-8000-000000000000').set(p.headers)).status,
    ).toBe(404);
    expect((await api().get(`/api/events/${deleted.id}`).set(p.headers)).status).toBe(404);
    expect((await api().get('/api/events/not-a-uuid').set(p.headers)).status).toBe(400);
  });
});

describe('PATCH/DELETE/reschedule', () => {
  it('lets the owner update, reschedule and delete', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const e = await createEvent(t.db, org.user.id);
    const upd = await api()
      .patch(`/api/events/${e.id}`)
      .set(org.headers)
      .send({ title: 'Renamed', capacity: 20 });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ title: 'Renamed', capacity: 20 });

    const newStart = inDays(20);
    const re = await api()
      .post(`/api/events/${e.id}/reschedule`)
      .set(org.headers)
      .send({ startsAt: newStart });
    expect(re.status).toBe(200);
    expect(new Date(re.body.data.startsAt).toISOString()).toBe(newStart);

    expect((await api().delete(`/api/events/${e.id}`).set(org.headers)).status).toBe(204);
    expect((await api().get(`/api/events/${e.id}`).set(org.headers)).status).toBe(404);
    expect((await api().delete(`/api/events/${e.id}`).set(org.headers)).status).toBe(404);
  });

  it("forbids another organizer from touching someone else's event", async () => {
    const owner = await actor(t.db, 'ORGANIZER');
    const intruder = await actor(t.db, 'ORGANIZER');
    const e = await createEvent(t.db, owner.user.id);
    expect(
      (await api().patch(`/api/events/${e.id}`).set(intruder.headers).send({ title: 'Hijack' }))
        .status,
    ).toBe(403);
    expect(
      (
        await api()
          .post(`/api/events/${e.id}/reschedule`)
          .set(intruder.headers)
          .send({ startsAt: inDays(9) })
      ).status,
    ).toBe(403);
    expect((await api().delete(`/api/events/${e.id}`).set(intruder.headers)).status).toBe(403);
    const stored = await t.db.event.findUniqueOrThrow({ where: { id: e.id } });
    expect(stored.title).toBe('Transfer Meetup');
    expect(stored.deletedAt).toBeNull();
  });

  it('forbids participants and requires auth', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const e = await createEvent(t.db, org.user.id);
    expect(
      (await api().patch(`/api/events/${e.id}`).set(p.headers).send({ title: 'x' })).status,
    ).toBe(403);
    expect((await api().delete(`/api/events/${e.id}`).set(p.headers)).status).toBe(403);
    expect((await api().patch(`/api/events/${e.id}`).send({ title: 'x' })).status).toBe(401);
  });

  it('rejects invalid updates without modifying the event', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const e = await createEvent(t.db, org.user.id);
    const bad = await api().patch(`/api/events/${e.id}`).set(org.headers).send({ capacity: -1 });
    expect(bad.status).toBe(400);
    const endBefore = await api()
      .patch(`/api/events/${e.id}`)
      .set(org.headers)
      .send({ endsAt: inDays(-3) });
    expect(endBefore.status).toBe(400);
    expect((await t.db.event.findUniqueOrThrow({ where: { id: e.id } })).capacity).toBe(10);
  });

  it('404s for a missing event', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const id = '00000000-0000-4000-8000-000000000000';
    expect(
      (await api().patch(`/api/events/${id}`).set(org.headers).send({ title: 'x' })).status,
    ).toBe(404);
  });

  it('refuses to lower capacity below the joined count (409)', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const e = await createEvent(t.db, org.user.id, { capacity: 3 });
    for (let i = 0; i < 3; i++) {
      const p = await actor(t.db);
      await api().post(`/api/events/${e.id}/join`).set(p.headers);
    }
    const res = await api().patch(`/api/events/${e.id}`).set(org.headers).send({ capacity: 2 });
    expect(res.status).toBe(409);
  });

  it('promotes waitlisted users when capacity is increased', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const e = await createEvent(t.db, org.user.id, { capacity: 1, waitlistEnabled: true });
    const [a, b, c] = [await actor(t.db), await actor(t.db), await actor(t.db)];
    for (const x of [a, b, c]) await api().post(`/api/events/${e.id}/join`).set(x.headers);
    const res = await api().patch(`/api/events/${e.id}`).set(org.headers).send({ capacity: 2 });
    expect(res.body.data.joinedCount).toBe(2);
    expect((await api().get(`/api/events/${e.id}/status`).set(b.headers)).body.data.status).toBe(
      'joined',
    );
    expect((await api().get(`/api/events/${e.id}/status`).set(c.headers)).body.data).toMatchObject({
      status: 'waitlisted',
      waitlistPosition: 1,
    });
  });
});

describe('GET /api/events/:eventId/participants', () => {
  it('shows public participant info only to the owner', async () => {
    const owner = await actor(t.db, 'ORGANIZER');
    const other = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const e = await createEvent(t.db, owner.user.id);
    await api().post(`/api/events/${e.id}/join`).set(p.headers);

    const res = await api().get(`/api/events/${e.id}/participants`).set(owner.headers);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain(p.user.universityEmail);
    expect((await api().get(`/api/events/${e.id}/participants`).set(other.headers)).status).toBe(
      403,
    );
    expect((await api().get(`/api/events/${e.id}/participants`).set(p.headers)).status).toBe(403);
    expect((await api().get(`/api/events/${e.id}/participants`)).status).toBe(401);
  });
});
