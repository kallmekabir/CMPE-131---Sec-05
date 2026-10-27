import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { AuthController } from '../controllers/authController';
import { wrap } from './asyncHandler';

export function authRouter(
  c: AuthController,
  authenticate: RequestHandler,
  limiter: RequestHandler,
) {
  const router = Router();
  router.post('/register', limiter, wrap(c.register));
  router.post('/login', limiter, wrap(c.login));
  router.post('/verify-email', limiter, wrap(c.verifyEmail));
  router.post('/refresh', limiter, wrap(c.refresh));
  router.post('/logout', limiter, wrap(c.logout));
  router.get('/me', authenticate, wrap(c.me));
  return router;
}
