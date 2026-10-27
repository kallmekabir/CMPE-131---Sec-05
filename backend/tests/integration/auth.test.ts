import request from 'supertest';
import {
  buildTestApp,
  createUser,
  resetDatabase,
  TEST_PASSWORD,
  tokenFor,
  bearer,
} from '../helpers/testApp';

const t = buildTestApp();
const api = () => request(t.app);

beforeEach(() => resetDatabase(t.db));
afterAll(() => t.db.$disconnect());

const registration = (over: object = {}) => ({
  name: 'Sam Spartan',
  universityEmail: 'sam@sjsu.edu',
  password: TEST_PASSWORD,
  ...over,
});

describe('POST /api/auth/register', () => {
  it('creates a participant and never returns credentials', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send(registration({ role: 'ORGANIZER' }));
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('PARTICIPANT');
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('rejects non-university emails with field details', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send(registration({ universityEmail: 'a@gmail.com' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMAIL_NOT_ALLOWED');
  });

  it('rejects invalid input without creating a user', async () => {
    const res = await api().post('/api/auth/register').send({ name: '', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toHaveProperty('password');
    expect(await t.db.user.count()).toBe(0);
  });

  it('returns 409 for a duplicate email', async () => {
    await createUser(t.db, { email: 'sam@sjsu.edu' });
    const res = await api().post('/api/auth/register').send(registration());
    expect(res.status).toBe(409);
  });
});

describe('email verification flow (local provider)', () => {
  const local = buildTestApp({ AUTH_PROVIDER: 'local' });
  afterAll(() => local.db.$disconnect());

  it('blocks login until verified, then allows it', async () => {
    const reg = await request(local.app).post('/api/auth/register').send(registration());
    expect(reg.status).toBe(201);
    expect(reg.body.data.verificationEmailSent).toBe(true);

    const blocked = await request(local.app)
      .post('/api/auth/login')
      .send({ universityEmail: 'sam@sjsu.edu', password: TEST_PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const token = new URL(local.email.sent[0]!.verificationUrl).searchParams.get('token');
    expect((await request(local.app).post('/api/auth/verify-email').send({ token })).status).toBe(
      200,
    );
    expect((await request(local.app).post('/api/auth/verify-email').send({ token })).status).toBe(
      401,
    );

    const ok = await request(local.app)
      .post('/api/auth/login')
      .send({ universityEmail: 'sam@sjsu.edu', password: TEST_PASSWORD });
    expect(ok.status).toBe(200);
  });

  it('still creates the account when the email service is down', async () => {
    local.email.failWith = new Error('smtp down');
    const res = await request(local.app)
      .post('/api/auth/register')
      .send(registration({ universityEmail: 'down@sjsu.edu' }));
    local.email.failWith = null;
    expect(res.status).toBe(201);
    expect(res.body.data.verificationEmailSent).toBe(false);
    expect(await local.db.user.count({ where: { universityEmail: 'down@sjsu.edu' } })).toBe(1);
  });
});

describe('POST /api/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const user = await createUser(t.db);
    const res = await api()
      .post('/api/auth/login')
      .send({ universityEmail: user.universityEmail, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('gives the same 401 for wrong password and unknown email', async () => {
    const user = await createUser(t.db);
    const wrong = await api()
      .post('/api/auth/login')
      .send({ universityEmail: user.universityEmail, password: 'wrong-password' });
    const unknown = await api()
      .post('/api/auth/login')
      .send({ universityEmail: 'nobody@sjsu.edu', password: 'wrong-password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('rejects an invalid body', async () => {
    expect((await api().post('/api/auth/login').send({})).status).toBe(400);
  });
});

describe('refresh and logout', () => {
  const login = async () => {
    const user = await createUser(t.db);
    const res = await api()
      .post('/api/auth/login')
      .send({ universityEmail: user.universityEmail, password: TEST_PASSWORD });
    return res.body.data as { accessToken: string; refreshToken: string };
  };

  it('rotates refresh tokens and rejects reuse', async () => {
    const { refreshToken } = await login();
    const first = await api().post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(refreshToken);
    expect((await api().post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  it('allows only one of several concurrent refreshes', async () => {
    const { refreshToken } = await login();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => api().post('/api/auth/refresh').send({ refreshToken })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('logout revokes the refresh token', async () => {
    const { refreshToken } = await login();
    expect((await api().post('/api/auth/logout').send({ refreshToken })).status).toBe(204);
    expect((await api().post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  it('rejects an unknown refresh token and a missing body', async () => {
    expect((await api().post('/api/auth/refresh').send({ refreshToken: 'nope' })).status).toBe(401);
    expect((await api().post('/api/auth/refresh').send({})).status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the caller profile', async () => {
    const user = await createUser(t.db);
    const res = await api()
      .get('/api/auth/me')
      .set(bearer(tokenFor(user.id, user.role)));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
  });

  it('rejects unauthenticated requests', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
  });

  it('returns 401 when the token user no longer exists', async () => {
    const user = await createUser(t.db);
    await t.db.user.delete({ where: { id: user.id } });
    const res = await api()
      .get('/api/auth/me')
      .set(bearer(tokenFor(user.id, user.role)));
    expect(res.status).toBe(401);
  });
});
