import type { RequestHandler } from 'express';
import type { UserRole } from '../domain/auth';
import { forbidden, invalidToken, unauthenticated } from '../errors/AppError';
import type { TokenService } from '../services/tokenService';

export function authenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header) return next(unauthenticated());
    const [scheme, token, ...rest] = header.split(' ');
    if (scheme !== 'Bearer' || !token || rest.length > 0) return next(invalidToken());
    try {
      req.auth = tokens.verifyAccessToken(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthenticated());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
