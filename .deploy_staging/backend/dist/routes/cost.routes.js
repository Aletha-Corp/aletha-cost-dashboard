"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.costRouter = void 0;
const express_1 = require("express");
const cost_validator_1 = require("../validators/cost.validator");
const cost_service_1 = require("../services/cost.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.costRouter = router;
/**
 * GET /api/costs/summary
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/summary', async (req, res, next) => {
    try {
        const parsed = cost_validator_1.costQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
        }
        const summary = await (0, cost_service_1.getCostSummary)(parsed.data);
        return res.json(summary);
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/costs/by-resource-group
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/by-resource-group', async (req, res, next) => {
    try {
        const parsed = cost_validator_1.costQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
        }
        const data = await (0, cost_service_1.getCostsByResourceGroup)(parsed.data);
        return res.json(data);
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/costs/entries
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/entries', async (req, res, next) => {
    try {
        const parsed = cost_validator_1.costQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
        }
        const entries = await (0, cost_service_1.getAllCostEntries)(parsed.data);
        return res.json(entries);
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/costs/by-owner
 * Query params: startDate, endDate, [subscriptionId]
 */
router.get('/by-owner', async (req, res, next) => {
    try {
        const parsed = cost_validator_1.costQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
        }
        const data = await (0, cost_service_1.getCostsByOwner)(parsed.data);
        return res.json(data);
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/costs/health
 * Liveness check — does not touch Azure APIs.
 */
router.get('/health', (_req, res) => {
    logger_1.logger.debug('Health check requested');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
//# sourceMappingURL=cost.routes.js.map