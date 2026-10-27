import request from 'supertest';
import { actor, buildTestApp, createEvent, resetDatabase } from '../helpers/testApp';

const t = buildTestApp();
const api = () => request(t.app);
beforeEach(() => resetDatabase(t.db));
afterAll(() => t.db.$disconnect());

const startsAt = new Date(Date.now() + 5 * 86400000).toISOString();
const newEvent = { title: 'T', description: 'D', startsAt, location: 'L' };

describe('participant calling organizer endpoints', () => {
  it('is forbidden everywhere an organizer role is required', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const e = await createEvent(t.db, org.user.id);
    const calls = [
      api().post('/api/events').set(p.headers).send(newEvent),
      api().patch(`/api/events/${e.id}`).set(p.headers).send({ title: 'x' }),
      api().delete(`/api/events/${e.id}`).set(p.headers),
      api().post(`/api/events/${e.id}/reschedule`).set(p.headers).send({ startsAt }),
      api().get(`/api/events/${e.id}/participants`).set(p.headers),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(403);
    expect(await t.db.event.count()).toBe(1);
  });
});

describe('organizer ownership', () => {
  it("another organizer cannot change or delete someone else's event", async () => {
    const owner = await actor(t.db, 'ORGANIZER');
    const other = await actor(t.db, 'ORGANIZER');
    const e = await createEvent(t.db, owner.user.id);
    expect(
      (await api().patch(`/api/events/${e.id}`).set(other.headers).send({ capacity: 1 })).status,
    ).toBe(403);
    expect((await api().delete(`/api/events/${e.id}`).set(other.headers)).status).toBe(403);
    const stored = await t.db.event.findUniqueOrThrow({ where: { id: e.id } });
    expect(stored).toMatchObject({ capacity: 10, deletedAt: null, organizerId: owner.user.id });
  });

  it('cannot transfer ownership through update', async () => {
    const owner = await actor(t.db, 'ORGANIZER');
    const other = await actor(t.db, 'ORGANIZER');
    const e = await createEvent(t.db, owner.user.id);
    const res = await api()
      .patch(`/api/events/${e.id}`)
      .set(owner.headers)
      .send({ organizerId: other.user.id });
    expect(res.status).toBe(400);
    expect((await t.db.event.findUniqueOrThrow({ where: { id: e.id } })).organizerId).toBe(
      owner.user.id,
    );
  });
});

describe('participation isolation', () => {
  it("a user cannot remove or alter another user's participation", async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const a = await actor(t.db);
    const attacker = await actor(t.db);
    const e = await createEvent(t.db, org.user.id);
    await api().post(`/api/events/${e.id}/join`).set(a.headers);

    await api().post(`/api/events/${e.id}/leave`).set(attacker.headers).send({ userId: a.user.id });
    await api().post(`/api/events/${e.id}/pass`).set(attacker.headers).send({ userId: a.user.id });
    const row = await t.db.participation.findUniqueOrThrow({
      where: { userId_eventId: { userId: a.user.id, eventId: e.id } },
    });
    expect(row.status).toBe('JOINED');
  });
});

describe('role escalation', () => {
  it('cannot be achieved through the profile endpoint', async () => {
    const p = await actor(t.db);
    const res = await api().patch('/api/users/me').set(p.headers).send({ role: 'ORGANIZER' });
    expect(res.status).toBe(400);
    expect((await t.db.user.findUniqueOrThrow({ where: { id: p.user.id } })).role).toBe(
      'PARTICIPANT',
    );
    expect((await api().post('/api/events').set(p.headers).send(newEvent)).status).toBe(403);
  });

  it('a token claiming ORGANIZER signed with the wrong key is rejected', async () => {
    const p = await actor(t.db);
    const jwt = await import('jsonwebtoken');
    const forged = jwt.sign({ role: 'ORGANIZER' }, 'attacker-key-attacker-key-attacker-key', {
      subject: p.user.id,
    });
    const res = await api()
      .post('/api/events')
      .set({ Authorization: `Bearer ${forged}` })
      .send(newEvent);
    expect(res.status).toBe(401);
  });
});

describe('private-field exposure', () => {
  it('never leaks emails, hashes or tokens in event, participant or user responses', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const e = await createEvent(t.db, org.user.id);
    await api().post(`/api/events/${e.id}/join`).set(p.headers);
    const bodies = [
      (await api().get('/api/events').set(p.headers)).text,
      (await api().get(`/api/events/${e.id}`).set(p.headers)).text,
      (await api().get(`/api/events/${e.id}/participants`).set(org.headers)).text,
      (await api().get('/api/users/me/events').set(org.headers)).text,
    ].join('\n');
    expect(bodies).not.toContain(org.user.universityEmail);
    expect(bodies).not.toContain(p.user.universityEmail);
    expect(bodies).not.toMatch(
      /passwordHash|password_hash|\$2[aby]\$|refreshToken|studentId|phone/i,
    );
  });
});

describe('injection-style input', () => {
  const payloads = ["' OR '1'='1", "'; DROP TABLE users; --", '${7*7}', '{"$ne":null}', '%00'];

  it('is stored and queried as plain text, never executed', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    for (const payload of payloads) {
      await api().get('/api/events').query({ q: payload, tag: payload }).set(org.headers);
      await api()
        .post('/api/events')
        .set(org.headers)
        .send({ ...newEvent, description: payload });
    }
    expect(await t.db.user.count()).toBe(1);
    expect((await api().get('/api/events?q=%27%20OR%201%3D1').set(org.headers)).status).toBe(200);
  });

  it('rejects markup in short labels and oversized bodies', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const xss = await api()
      .post('/api/events')
      .set(org.headers)
      .send({ ...newEvent, title: '<img src=x onerror=alert(1)>' });
    expect(xss.status).toBe(400);
    const huge = await api()
      .post('/api/events')
      .set(org.headers)
      .send({ ...newEvent, description: 'a'.repeat(200_000) });
    expect(huge.status).toBe(413);
  });
});

describe('response hardening', () => {
  it('sends security headers and hides stack traces', async () => {
    const res = await api().get('/definitely-missing');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text).not.toMatch(/at .*\.ts:\d+/);
  });
});
