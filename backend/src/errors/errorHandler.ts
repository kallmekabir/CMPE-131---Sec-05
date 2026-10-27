import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, notFound } from './AppError';
import type { Logger } from '../logging/logger';

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      (fields[key] ??= []).push(issue.message);
    }
    return new AppError('VALIDATION_ERROR', 400, 'Invalid request.', { fields });
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') {
    return new AppError('VALIDATION_ERROR', 400, 'Malformed JSON body.');
  }
  if (e?.type === 'entity.too.large') {
    return new AppError('VALIDATION_ERROR', 413, 'Request body too large.');
  }
  return new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('Route'));

export function createErrorHandler(logger: Logger, isProduction: boolean): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const appError = toAppError(err);
    const context = { requestId: req.id, method: req.method, path: req.path, code: appError.code };
    if (appError.status >= 500) {
      logger.error({ ...context, err: isProduction ? undefined : err }, 'request failed');
    } else {
      logger.warn(context, 'request rejected');
    }
    res.status(appError.status).json({
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
      },
      requestId: req.id,
    });
  };
}
