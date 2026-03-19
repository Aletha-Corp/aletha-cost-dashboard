"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
function errorHandler(err, _req, res, _next) {
    const statusCode = err.statusCode ?? 500;
    logger_1.logger.error('Unhandled error', {
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        statusCode,
    });
    // Never leak internal details to clients in production
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'An internal server error occurred'
        : err.message;
    res.status(statusCode).json({ error: message });
}
//# sourceMappingURL=error-handler.middleware.js.map