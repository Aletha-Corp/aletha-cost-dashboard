"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const security_service_1 = require("../services/security.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.securityRouter = router;
const scanQuerySchema = zod_1.z.object({
    subscriptionId: zod_1.z.string().min(1).optional(),
    force: zod_1.z.string().optional(),
});
/**
 * GET /api/security/scan
 * Runs (or returns cached) security scan of the subscription.
 * Optional query params:
 *   subscriptionId - override env default
 *   force=true     - bypass cache and trigger fresh scan
 */
router.get('/scan', async (req, res, next) => {
    try {
        const parsed = scanQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
        }
        if (parsed.data.force === 'true') {
            (0, security_service_1.invalidateSecurityCache)();
            logger_1.logger.info('Security cache force-invalidated by request');
        }
        const report = await (0, security_service_1.runSecurityScan)(parsed.data.subscriptionId);
        return res.json(report);
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/security/health
 * Liveness check — does not trigger a scan.
 */
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'security' });
});
//# sourceMappingURL=security.routes.js.map