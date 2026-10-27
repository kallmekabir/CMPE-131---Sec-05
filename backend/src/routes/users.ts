import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { UserController } from '../controllers/userController';
import { wrap } from './asyncHandler';

export function userRouter(c: UserController, authenticate: RequestHandler) {
  const router = Router();
  router.use(authenticate);
  router.get('/me', wrap(c.me));
  router.patch('/me', wrap(c.update));
  router.get('/me/events', wrap(c.events));
  router.get('/me/participation', wrap(c.participation));
  return router;
}
