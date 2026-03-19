"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    AZURE_TENANT_ID: zod_1.z.string().min(1, 'AZURE_TENANT_ID is required'),
    AZURE_CLIENT_ID: zod_1.z.string().min(1, 'AZURE_CLIENT_ID is required'),
    AZURE_CLIENT_SECRET: zod_1.z.string().min(1, 'AZURE_CLIENT_SECRET is required'),
    AZURE_SUBSCRIPTION_ID: zod_1.z.string().min(1, 'AZURE_SUBSCRIPTION_ID is required'),
    PORT: zod_1.z.string().default('3001'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:5173'),
    RATE_LIMIT_WINDOW_MS: zod_1.z.string().default('900000'),
    RATE_LIMIT_MAX: zod_1.z.string().default('100'),
});
function loadEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        const missing = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
        throw new Error(`Environment validation failed:\n${missing}\n\nCopy backend/.env.example to backend/.env and fill in your Azure credentials.`);
    }
    return result.data;
}
exports.env = loadEnv();
//# sourceMappingURL=env.js.map