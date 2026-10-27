import { loadConfig } from '../../src/config';

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('applies defaults for optional values', () => {
    const config = loadConfig(valid);
    expect(config.port).toBe(3000);
    expect(config.allowedEmailDomains).toEqual(['sjsu.edu']);
  });

  it('fails fast when a required variable is missing', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/);
  });

  it('rejects short JWT secrets without echoing the value', () => {
    expect(() => loadConfig({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('refuses the dev auth provider in production', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: 'production', AUTH_PROVIDER: 'dev' })).toThrow(
      /not allowed/,
    );
  });
});
