"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = require("winston");
const env_1 = require("../config/env");
exports.logger = (0, winston_1.createLogger)({
    level: env_1.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston_1.format.combine(winston_1.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.format.errors({ stack: true }), env_1.env.NODE_ENV === 'production'
        ? winston_1.format.json()
        : winston_1.format.combine(winston_1.format.colorize(), winston_1.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}]: ${message}${metaStr}`;
        }))),
    transports: [new winston_1.transports.Console()],
});
//# sourceMappingURL=logger.js.map