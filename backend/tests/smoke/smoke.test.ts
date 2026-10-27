import request from 'supertest';
import {
  buildTestApp,
  resetDatabase,
  TEST_PASSWORD,
  createUser,
  createEvent,
} from '../helpers/testApp';

const t = buildTestApp();
beforeAll(() => resetDatabase(t.db));
afterAll(() => t.db.$disconnect());

describe('backend smoke test', () => {
  it('runs the core flow end to end', async () => {
    const api = request(t.app);

    // 1-2. server responds and the database is reachable
    const health = await api.get('/health');
    expect(health.status).toBe(200);
    expect(health.body.data.database).toBe('up');

    // 3. a test user can authenticate
    const organizer = await createUser(t.db, { role: 'ORGANIZER' });
    const participant = await createUser(t.db);
    const other = await createUser(t.db, { role: 'ORGANIZER' });
    const login = async (email: string) =>
      (await api.post('/api/auth/login').send({ universityEmail: email, password: TEST_PASSWORD }))
        .body.data.accessToken as string;
    const [orgToken, partToken, otherToken] = await Promise.all([
      login(organizer.universityEmail),
      login(participant.universityEmail),
      login(other.universityEmail),
    ]);
    const as = (token: string) => ({ Authorization: `Bearer ${token}` });

    // 4. an authenticated user can retrieve events
    expect((await api.get('/api/events').set(as(partToken))).status).toBe(200);

    // 5. an organizer can create an event
    const created = await api
      .post('/api/events')
      .set(as(orgToken))
      .send({
        title: 'Smoke Event',
        description: 'Smoke',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        location: 'Union',
        capacity: 1,
        waitlistEnabled: true,
      });
    expect(created.status).toBe(201);
    const eventId = created.body.data.id as string;

    // 6-7. a participant can join, and a duplicate join creates no second record
    expect(
      (await api.post(`/api/events/${eventId}/join`).set(as(partToken))).body.data.status,
    ).toBe('joined');
    await api.post(`/api/events/${eventId}/join`).set(as(partToken));
    expect(await t.db.participation.count({ where: { eventId, userId: participant.id } })).toBe(1);

    // 8. a full event waitlists the next user
    const late = await createUser(t.db);
    const lateToken = await login(late.universityEmail);
    const waitlisted = await api.post(`/api/events/${eventId}/join`).set(as(lateToken));
    expect(waitlisted.body.data).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });
    const noWait = await createEvent(t.db, organizer.id, { capacity: 0, waitlistEnabled: false });
    expect(
      (await api.post(`/api/events/${noWait.id}/join`).set(as(partToken))).body.error.code,
    ).toBe('EVENT_FULL');

    // 9. an unauthorized user cannot modify the event
    expect(
      (await api.patch(`/api/events/${eventId}`).set(as(otherToken)).send({ title: 'Hijack' }))
        .status,
    ).toBe(403);
    expect(
      (await api.patch(`/api/events/${eventId}`).set(as(partToken)).send({ title: 'Hijack' }))
        .status,
    ).toBe(403);
  });
});
