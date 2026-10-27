import type { ZodType } from 'zod';

export const parse = <T>(schema: ZodType<T>, data: unknown): T => schema.parse(data);
