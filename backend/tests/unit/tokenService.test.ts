import jwt from 'jsonwebtoken';
import {
  TokenService,
  hashOpaqueToken,
  generateOpaqueToken,
} from '../../src/services/tokenService';

const secret = 'unit-test-secret-that-is-at-least-32-chars';
const service = new TokenService({ secret, accessTtlSeconds: 60 });

describe('TokenService', () => {
  it('round-trips an access token', () => {
    const token = service.signAccessToken({ userId: 'u1', role: 'ORGANIZER' });
    expect(service.verifyAccessToken(token)).toEqual({ userId: 'u1', role: 'ORGANIZER' });
  });

  it('reports expired tokens distinctly', () => {
    const token = jwt.sign({ role: 'PARTICIPANT' }, secret, { subject: 'u1', expiresIn: -10 });
    expect(() => service.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
    );
  });

  it('rejects tokens signed with another secret', () => {
    const token = jwt.sign({ role: 'PARTICIPANT' }, 'another-secret-another-secret-123456', {
      subject: 'u1',
    });
    expect(() => service.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ code: 'INVALID_TOKEN' }),
    );
  });

  it('rejects alg=none tokens', () => {
    const forged = jwt.sign({ role: 'ORGANIZER' }, '', { algorithm: 'none', subject: 'u1' });
    expect(() => service.verifyAccessToken(forged)).toThrow(
      expect.objectContaining({ code: 'INVALID_TOKEN' }),
    );
  });

  it('rejects tokens with an unknown role claim', () => {
    const token = jwt.sign({ role: 'ADMIN' }, secret, { subject: 'u1', expiresIn: 60 });
    expect(() => service.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ code: 'INVALID_TOKEN' }),
    );
  });

  it('hashes opaque tokens deterministically without storing the raw value', () => {
    const raw = generateOpaqueToken();
    expect(hashOpaqueToken(raw)).toBe(hashOpaqueToken(raw));
    expect(hashOpaqueToken(raw)).not.toContain(raw);
    expect(generateOpaqueToken()).not.toBe(raw);
  });
});
