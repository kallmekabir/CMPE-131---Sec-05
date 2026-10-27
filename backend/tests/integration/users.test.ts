import request from 'supertest';
import { actor, buildTestApp, createEvent, resetDatabase } from '../helpers/testApp';

const t = buildTestApp();
const api = () => request(t.app);
beforeEach(() => resetDatabase(t.db));
afterAll(() => t.db.$disconnect());

describe('GET/PATCH /api/users/me', () => {
  it('returns the caller profile without credentials', async () => {
    const { user, headers } = await actor(t.db);
    const res = await api().get('/api/users/me').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('requires authentication', async () => {
    expect((await api().get('/api/users/me')).status).toBe(401);
    expect((await api().patch('/api/users/me').send({ major: 'CS' })).status).toBe(401);
  });

  it('updates allowed fields and normalizes interests', async () => {
    const { headers } = await actor(t.db);
    const res = await api()
      .patch('/api/users/me')
      .set(headers)
      .send({
        major: 'Computer Science',
        interests: ['Music', 'music', 'Hiking'],
        skills: ['React'],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.interests).toEqual(['music', 'hiking']);
  });

  it('rejects invalid input with field details', async () => {
    const { headers } = await actor(t.db);
    const res = await api().patch('/api/users/me').set(headers).send({ displayName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toHaveProperty('displayName');
  });

  it.each([
    { role: 'ORGANIZER' },
    { emailVerified: false },
    { universityEmail: 'other@sjsu.edu' },
    { passwordHash: 'x' },
    { id: '00000000-0000-0000-0000-000000000000' },
  ])('refuses protected field %o and leaves the user unchanged', async (body) => {
    const { user, headers } = await actor(t.db);
    const res = await api().patch('/api/users/me').set(headers).send(body);
    expect(res.status).toBe(400);
    const stored = await t.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.role).toBe('PARTICIPANT');
    expect(stored.universityEmail).toBe(user.universityEmail);
  });
});

describe('GET /api/users/me/events and /participation', () => {
  it('lists organizing and attending events', async () => {
    const org = await actor(t.db, 'ORGANIZER');
    const p = await actor(t.db);
    const event = await createEvent(t.db, org.user.id);
    await api().post(`/api/events/${event.id}/join`).set(p.headers);

    const mine = await api().get('/api/users/me/events').set(org.headers);
    expect(mine.body.data.organizing.map((e: { id: string }) => e.id)).toEqual([event.id]);

    const attending = await api().get('/api/users/me/events').set(p.headers);
    expect(attending.body.data.attending.map((e: { id: string }) => e.id)).toEqual([event.id]);

    const part = await api().get('/api/users/me/participation').set(p.headers);
    expect(part.status).toBe(200);
    expect(part.body.data[0]).toMatchObject({ status: 'joined', event: { id: event.id } });
  });

  it('rejects an out-of-range limit and unauthenticated calls', async () => {
    const { headers } = await actor(t.db);
    expect((await api().get('/api/users/me/events?limit=500').set(headers)).status).toBe(400);
    expect((await api().get('/api/users/me/participation')).status).toBe(401);
  });
});
