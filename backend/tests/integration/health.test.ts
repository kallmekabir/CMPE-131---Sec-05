import request from 'supertest';
import { loadConfig } from '../../src/config';
import { createDb } from '../../src/db/client';
import { createLogger } from '../../src/logging/logger';
import { createApp } from '../../src/app/createApp';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const app = createApp({ config, db, logger: createLogger('silent') });

afterAll(() => db.$disconnect());

describe('GET /health', () => {
  it('reports database connectivity and a request id', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
  });
});
