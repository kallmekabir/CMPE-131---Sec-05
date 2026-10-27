export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'EVENT_FULL'
  | 'EVENT_UNAVAILABLE'
  | 'EMAIL_NOT_ALLOWED'
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const validationError = (details: Record<string, unknown>, message = 'Invalid request.') =>
  new AppError('VALIDATION_ERROR', 400, message, details);
export const unauthenticated = (message = 'Authentication required.') =>
  new AppError('UNAUTHENTICATED', 401, message);
export const invalidToken = () =>
  new AppError('INVALID_TOKEN', 401, 'Invalid authentication token.');
export const tokenExpired = () =>
  new AppError('TOKEN_EXPIRED', 401, 'Authentication token has expired.');
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new AppError('FORBIDDEN', 403, message);
export const notFound = (resource = 'Resource') =>
  new AppError('NOT_FOUND', 404, `${resource} not found.`);
export const conflict = (message: string, details: Record<string, unknown> = {}) =>
  new AppError('CONFLICT', 409, message, details);
export const eventFull = () => new AppError('EVENT_FULL', 409, 'This event is full.');
export const eventUnavailable = () =>
  new AppError('EVENT_UNAVAILABLE', 409, 'This event is no longer available.');
export const dependencyUnavailable = (service: string) =>
  new AppError('DEPENDENCY_UNAVAILABLE', 503, `${service} is temporarily unavailable.`);
