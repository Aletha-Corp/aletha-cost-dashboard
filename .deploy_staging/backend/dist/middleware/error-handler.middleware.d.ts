import { Request, Response, NextFunction } from 'express';
interface AppError extends Error {
    statusCode?: number;
}
export declare function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void;
export {};
//# sourceMappingURL=error-handler.middleware.d.ts.map