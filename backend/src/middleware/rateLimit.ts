import { rateLimit } from 'express-rate-limit';
import { AppError } from '../errors/AppError';

export const createRateLimiter = (max: number, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 429, 'Too many requests. Try again later.')),
  });
