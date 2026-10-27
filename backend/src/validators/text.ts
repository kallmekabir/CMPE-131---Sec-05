import { z } from 'zod';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const safeText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? 'Required' : `Must be at least ${min} characters`)
    .max(max, `Must be at most ${max} characters`)
    .refine((v) => !CONTROL_CHARS.test(v), 'Contains invalid control characters');

export const plainLabel = (min: number, max: number) =>
  safeText(min, max).refine((v) => !/[<>]/.test(v), 'Must not contain < or >');

export const tagList = z
  .array(plainLabel(1, 30).transform((t) => t.toLowerCase()))
  .max(10, 'At most 10 entries')
  .transform((tags) => [...new Set(tags)]);
