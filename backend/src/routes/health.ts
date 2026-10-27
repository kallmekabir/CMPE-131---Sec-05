import { Router } from 'express';
import type { Db } from '../db/client';

export function healthRouter(db: Db) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { status: 'ok', database: 'up' } });
    } catch {
      res.status(503).json({
        success: false,
        error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Database is unavailable.', details: {} },
      });
    }
  });

  return router;
}
