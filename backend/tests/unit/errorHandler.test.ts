import { z } from 'zod';
import { toAppError } from '../../src/errors/errorHandler';
import { AppError, eventFull } from '../../src/errors/AppError';

describe('toAppError', () => {
  it('passes AppError through unchanged', () => {
    const err = eventFull();
    expect(toAppError(err)).toBe(err);
  });

  it('maps zod issues to field-specific validation details', () => {
    const result = z.object({ title: z.string().min(3) }).safeParse({ title: 'a' });
    const mapped = toAppError(result.error);
    expect(mapped.code).toBe('VALIDATION_ERROR');
    expect(mapped.status).toBe(400);
    expect(Object.keys((mapped.details as { fields: object }).fields)).toEqual(['title']);
  });

  it('maps malformed JSON bodies to 400', () => {
    expect(toAppError({ type: 'entity.parse.failed' }).status).toBe(400);
  });

  it('hides unknown error details behind a generic 500', () => {
    const mapped = toAppError(new Error('connection string postgres://secret'));
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.status).toBe(500);
    expect(mapped.message).not.toMatch(/secret/);
  });
});
