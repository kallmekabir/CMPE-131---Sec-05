import request from 'supertest';
import { loadConfig } from '../../src/config';
import { createDb } from '../../src/db/client';
import { createLogger } from '../../src/logging/logger';
import { createApp } from '../../src/app/createApp';
import { actor, createEvent, resetDatabase } from '../helpers/testApp';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const boom = async () => {
  throw new Error('provider down');
};
const working = createApp({ config, db, logger: createLogger('silent') });
const failing = createApp({
  config,
  db,
  logger: createLogger('silent'),
  integrations: {
    maps: { getLinks: boom },
    calendar: { create: boom },
    sharing: { createLinks: boom },
  },
});
const t = { db };

beforeEach(() => resetDatabase(db));
afterAll(() => db.$disconnect());

const setup = async () => {
  const org = await actor(t.db, 'ORGANIZER');
  const p = await actor(t.db);
  const event = await createEvent(t.db, org.user.id, { tags: ['music'] });
  return { p, event };
};

describe('integration endpoints (adapters working)', () => {
  it.each(['map', 'navigation-link', 'share-link', 'calendar-link'])(
    'GET /:eventId/%s succeeds',
    async (path) => {
      const { p, event } = await setup();
      const res = await request(working).get(`/api/events/${event.id}/${path}`).set(p.headers);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    },
  );

  it('returns usable link data', async () => {
    const { p, event } = await setup();
    const map = await request(working).get(`/api/events/${event.id}/map`).set(p.headers);
    expect(map.body.data).toMatchObject({ available: true, location: 'Student Union' });
    const share = await request(working).get(`/api/events/${event.id}/share-link`).set(p.headers);
    expect(share.body.data.deepLink).toBe(`spartin://events/${event.id}`);
    const cal = await request(working).get(`/api/events/${event.id}/calendar-link`).set(p.headers);
    expect(cal.body.data.ics).toContain('BEGIN:VEVENT');
  });

  it.each(['map', 'navigation-link', 'share-link', 'calendar-link'])(
    '%s: 404, 400 and 401 cases',
    async (path) => {
      const { p, event } = await setup();
      const missing = '00000000-0000-4000-8000-000000000000';
      expect(
        (await request(working).get(`/api/events/${missing}/${path}`).set(p.headers)).status,
      ).toBe(404);
      expect((await request(working).get(`/api/events/bad/${path}`).set(p.headers)).status).toBe(
        400,
      );
      expect((await request(working).get(`/api/events/${event.id}/${path}`)).status).toBe(401);
    },
  );
});

describe('integration endpoints (adapters failing)', () => {
  it('map and navigation fall back to the text location', async () => {
    const { p, event } = await setup();
    const map = await request(failing).get(`/api/events/${event.id}/map`).set(p.headers);
    expect(map.status).toBe(200);
    expect(map.body.data).toEqual({
      available: false,
      location: 'Student Union',
      mapUrl: null,
      navigationUrl: null,
    });
    const nav = await request(failing)
      .get(`/api/events/${event.id}/navigation-link`)
      .set(p.headers);
    expect(nav.body.data).toMatchObject({ available: false, location: 'Student Union' });
  });

  it('calendar and sharing return 503 and leave core data intact', async () => {
    const { p, event } = await setup();
    const cal = await request(failing).get(`/api/events/${event.id}/calendar-link`).set(p.headers);
    const share = await request(failing).get(`/api/events/${event.id}/share-link`).set(p.headers);
    expect(cal.status).toBe(503);
    expect(cal.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(share.status).toBe(503);
    expect(JSON.stringify(cal.body)).not.toContain('provider down');
    const stored = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.title).toBe(event.title);
  });

  it('browsing and joining keep working while every adapter is down', async () => {
    const { p, event } = await setup();
    expect((await request(failing).get('/api/events').set(p.headers)).status).toBe(200);
    expect(
      (await request(failing).post(`/api/events/${event.id}/join`).set(p.headers)).body.data.status,
    ).toBe('joined');
  });
});

describe('GET /api/recommendations/events', () => {
  it('ranks events matching the user interests and excludes passed ones', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    await request(working)
      .patch('/api/users/me')
      .set(p.headers)
      .send({ interests: ['music'] });
    const match = await createEvent(t.db, org.user.id, { tags: ['music'] });
    const passed = await createEvent(t.db, org.user.id, { tags: ['music'] });
    await createEvent(t.db, org.user.id, { tags: ['chess'] });
    await request(working).post(`/api/events/${passed.id}/pass`).set(p.headers);

    const res = await request(working).get('/api/recommendations/events').set(p.headers);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { event: { id: string } }) => r.event.id)).toEqual([match.id]);
  });

  it('validates the limit and requires authentication', async () => {
    const p = await actor(t.db);
    expect(
      (await request(working).get('/api/recommendations/events?limit=999').set(p.headers)).status,
    ).toBe(400);
    expect((await request(working).get('/api/recommendations/events')).status).toBe(401);
  });
});
