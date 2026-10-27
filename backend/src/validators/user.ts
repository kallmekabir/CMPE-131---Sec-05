import { z } from 'zod';
import { plainLabel } from './text';

const labels = z
  .array(plainLabel(1, 50).transform((v) => v.toLowerCase()))
  .max(20, 'At most 20 entries')
  .transform((v) => [...new Set(v)]);

export const updateProfileSchema = z
  .object({
    name: plainLabel(1, 100),
    displayName: plainLabel(1, 50),
    major: plainLabel(1, 100).nullable(),
    interests: labels,
    skills: labels,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');
