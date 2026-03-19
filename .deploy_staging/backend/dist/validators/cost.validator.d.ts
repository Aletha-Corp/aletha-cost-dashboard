import { z } from 'zod';
export declare const costQuerySchema: z.ZodEffects<z.ZodObject<{
    startDate: z.ZodString;
    endDate: z.ZodString;
    subscriptionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    startDate: string;
    endDate: string;
    subscriptionId?: string | undefined;
}, {
    startDate: string;
    endDate: string;
    subscriptionId?: string | undefined;
}>, {
    startDate: string;
    endDate: string;
    subscriptionId?: string | undefined;
}, {
    startDate: string;
    endDate: string;
    subscriptionId?: string | undefined;
}>;
export type CostQueryInput = z.infer<typeof costQuerySchema>;
//# sourceMappingURL=cost.validator.d.ts.map