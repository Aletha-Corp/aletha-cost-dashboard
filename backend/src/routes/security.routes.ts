import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { runSecurityScan, invalidateSecurityCache } from '../services/security.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();

const scanQuerySchema = z.object({
  subscriptionId: z.string().min(1).optional(),
  force: z.string().optional(),
});

/**
 * GET /api/security/scan
 * Runs (or returns cached) security scan of the subscription.
 * Optional query params:
 *   subscriptionId - override env default
 *   force=true     - bypass cache and trigger fresh scan
 */
router.get('/scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scanQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }

    if (parsed.data.force === 'true') {
      invalidateSecurityCache();
      logger.info('Security cache force-invalidated by request');
    }

    const report = await runSecurityScan(parsed.data.subscriptionId);
    return res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/security/health
 * Liveness check — does not trigger a scan.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'security' });
});

export { router as securityRouter };
