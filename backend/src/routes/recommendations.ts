import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { IntegrationController } from '../controllers/integrationController';
import { wrap } from './asyncHandler';

export function recommendationRouter(c: IntegrationController, authenticate: RequestHandler) {
  const router = Router();
  router.get('/events', authenticate, wrap(c.recommendations));
  return router;
}
