"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.costQuerySchema = void 0;
const zod_1 = require("zod");
exports.costQuerySchema = zod_1.z.object({
    startDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format'),
    endDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format'),
    subscriptionId: zod_1.z.string().optional(),
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), { message: 'startDate must be before or equal to endDate', path: ['startDate'] });
//# sourceMappingURL=cost.validator.js.map