import request from 'supertest';
import { buildTestApp, createUser, resetDatabase, tokenFor, bearer } from '../helpers/testApp';

const t = buildTestApp();
beforeEach(() => resetDatabase(t.db));
afterAll(() => t.db.$disconnect());

describe('token rejection on protected routes', () => {
  it('missing token -> 401 UNAUTHENTICATED', async () => {
    const res = await request(t.app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('garbage token -> 401 INVALID_TOKEN', async () => {
    const res = await request(t.app).get('/api/auth/me').set(bearer('not.a.jwt'));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('expired token -> 401 TOKEN_EXPIRED', async () => {
    const user = await createUser(t.db);
    const res = await request(t.app)
      .get('/api/auth/me')
      .set(bearer(tokenFor(user.id, user.role, { expiresIn: -60 })));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('malformed Authorization header -> 401', async () => {
    const res = await request(t.app).get('/api/auth/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
  });
});

describe('credential and input safety', () => {
  it('never exposes password material in any auth response', async () => {
    const res = await request(t.app).post('/api/auth/register').send({
      name: 'Leak Check',
      universityEmail: 'leak@sjsu.edu',
      password: 'Sup3r-Secret-Pass',
    });
    expect(JSON.stringify(res.body)).not.toMatch(
      /Sup3r-Secret-Pass|\$2[aby]\$|passwordHash|password_hash/,
    );
  });

  it('treats SQL-injection-style credentials as plain strings', async () => {
    const user = await createUser(t.db);
    const res = await request(t.app)
      .post('/api/auth/login')
      .send({ universityEmail: "' OR '1'='1' --@sjsu.edu", password: "' OR '1'='1" });
    expect(res.status).toBe(401);
    expect(await t.db.user.count()).toBe(1);
    expect(user.id).toBeDefined();
  });

  it('cannot self-assign the organizer role at registration', async () => {
    const res = await request(t.app).post('/api/auth/register').send({
      name: 'Eve',
      universityEmail: 'eve@sjsu.edu',
      password: 'Sup3r-Secret-Pass',
      role: 'ORGANIZER',
    });
    expect(res.body.data.user.role).toBe('PARTICIPANT');
    const stored = await t.db.user.findUnique({ where: { universityEmail: 'eve@sjsu.edu' } });
    expect(stored?.role).toBe('PARTICIPANT');
  });
});

describe('rate limiting', () => {
  it('returns 429 after too many auth attempts', async () => {
    const limited = buildTestApp({ AUTH_RATE_LIMIT_MAX: '3' });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(limited.app)
        .post('/api/auth/login')
        .send({ universityEmail: 'x@sjsu.edu', password: 'whatever-pass' });
      statuses.push(res.status);
    }
    await limited.db.$disconnect();
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});
