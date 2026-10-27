import type { Request, Response } from 'express';
import { authenticate, requireRole } from '../../src/middleware/authenticate';
import { TokenService } from '../../src/services/tokenService';

const tokens = new TokenService({ secret: 'x'.repeat(40), accessTtlSeconds: 60 });
const run = (mw: ReturnType<typeof authenticate>, headers: Record<string, string>) => {
  const req = { headers } as unknown as Request;
  const next = jest.fn();
  mw(req, {} as Response, next);
  return { req, next };
};

describe('authenticate', () => {
  it('rejects a missing header as UNAUTHENTICATED', () => {
    expect(run(authenticate(tokens), {}).next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHENTICATED', status: 401 }),
    );
  });

  it.each(['Basic abc', 'Bearer', 'Bearer a b', 'bearer abc'])(
    'rejects malformed header %s',
    (h) => {
      expect(run(authenticate(tokens), { authorization: h }).next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_TOKEN' }),
      );
    },
  );

  it('attaches the auth context for a valid token', () => {
    const token = tokens.signAccessToken({ userId: 'u1', role: 'PARTICIPANT' });
    const { req, next } = run(authenticate(tokens), { authorization: `Bearer ${token}` });
    expect(next).toHaveBeenCalledWith();
    expect(req.auth).toEqual({ userId: 'u1', role: 'PARTICIPANT' });
  });
});

describe('requireRole', () => {
  const call = (role: 'PARTICIPANT' | 'ORGANIZER' | null) => {
    const req = { auth: role ? { userId: 'u', role } : undefined } as unknown as Request;
    const next = jest.fn();
    requireRole('ORGANIZER')(req, {} as Response, next);
    return next;
  };

  it('allows a permitted role', () => expect(call('ORGANIZER')).toHaveBeenCalledWith());
  it('forbids other roles with 403', () =>
    expect(call('PARTICIPANT')).toHaveBeenCalledWith(expect.objectContaining({ status: 403 })));
  it('requires authentication first', () =>
    expect(call(null)).toHaveBeenCalledWith(expect.objectContaining({ status: 401 })));
});
