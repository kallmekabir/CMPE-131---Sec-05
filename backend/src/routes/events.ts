import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { EventController } from '../controllers/eventController';
import type { IntegrationController } from '../controllers/integrationController';
import { requireRole } from '../middleware/authenticate';
import { wrap } from './asyncHandler';

export function eventRouter(
  c: EventController,
  i: IntegrationController,
  authenticate: RequestHandler,
) {
  const router = Router();
  const organizer = requireRole('ORGANIZER');
  router.use(authenticate);

  router.get('/', wrap(c.list));
  router.post('/', organizer, wrap(c.create));
  router.get('/:eventId', wrap(c.get));
  router.patch('/:eventId', organizer, wrap(c.update));
  router.delete('/:eventId', organizer, wrap(c.remove));
  router.post('/:eventId/reschedule', organizer, wrap(c.reschedule));
  router.get('/:eventId/participants', organizer, wrap(c.participants));
  router.get('/:eventId/status', wrap(c.status));
  router.post('/:eventId/pass', wrap(c.pass));
  router.post('/:eventId/join', wrap(c.join));
  router.post('/:eventId/leave', wrap(c.leave));
  router.get('/:eventId/map', wrap(i.map));
  router.get('/:eventId/navigation-link', wrap(i.navigation));
  router.get('/:eventId/share-link', wrap(i.share));
  router.get('/:eventId/calendar-link', wrap(i.calendar));
  return router;
}
