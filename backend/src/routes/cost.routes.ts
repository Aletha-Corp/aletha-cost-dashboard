import { Router, Request, Response, NextFunction } from 'express';
import { costQuerySchema } from '../validators/cost.validator';
import { getCostSummary, getCostsByResourceGroup, getAllCostEntries, getCostsByOwner } from '../services/cost.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/costs/summary
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = costQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }
    const summary = await getCostSummary(parsed.data);
    return res.json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/costs/by-resource-group
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/by-resource-group', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = costQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }
    const data = await getCostsByResourceGroup(parsed.data);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/costs/entries
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = costQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }
    const entries = await getAllCostEntries(parsed.data);
    return res.json(entries);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/costs/by-owner
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/by-owner', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = costQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }
    const data = await getCostsByOwner(parsed.data);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/costs/health
 * Liveness check — does not touch Azure APIs.
 */
router.get('/health', (_req: Request, res: Response) => {
  logger.debug('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { router as costRouter };
