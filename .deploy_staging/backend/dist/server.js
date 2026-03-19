"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const cost_routes_1 = require("./routes/cost.routes");
const security_routes_1 = require("./routes/security.routes");
const error_handler_middleware_1 = require("./middleware/error-handler.middleware");
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
// Ensure Web Crypto is available for Azure SDKs in Node 18 (needed by @azure/identity).
if (!globalThis.crypto) {
    globalThis.crypto = crypto_1.webcrypto;
}
// ─── Security middleware ────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.CORS_ORIGIN,
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(env_1.env.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(env_1.env.RATE_LIMIT_MAX, 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    // Azure App Service forwards IP:port in X-Forwarded-For — strip the port so the
    // rate-limiter gets a valid IP address key.
    keyGenerator: (req) => {
        const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        return ip.replace(/:\d+$/, '').replace(/^::ffff:/, '');
    },
    validate: { ip: false },
});
app.set('trust proxy', 1);
app.use('/api/', limiter);
// ─── General middleware ─────────────────────────────────────────────────────
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10kb' }));
app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Disable x-powered-by (helmet does this, but belt-and-suspenders)
app.disable('x-powered-by');
// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/costs', cost_routes_1.costRouter);
app.use('/api/security', security_routes_1.securityRouter);
// Root liveness probe (used by Azure App Service)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─── Error handler (must be last) ───────────────────────────────────────────
app.use(error_handler_middleware_1.errorHandler);
// ─── Serve static frontend in production ────────────────────────────────────
if (env_1.env.NODE_ENV === 'production') {
    const frontendDist = path_1.default.resolve(__dirname, '../../frontend/dist');
    app.use(express_1.default.static(frontendDist, { maxAge: '7d', etag: true }));
    // SPA catch-all — must come after API routes
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(frontendDist, 'index.html'));
    });
}
// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(env_1.env.PORT, 10);
app.listen(PORT, () => {
    logger_1.logger.info(`Azure Cost Dashboard API listening on port ${PORT} [${env_1.env.NODE_ENV}]`);
});
exports.default = app;
//# sourceMappingURL=server.js.map