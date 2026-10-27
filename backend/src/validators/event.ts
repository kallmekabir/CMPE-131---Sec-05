import { z } from 'zod';
import { plainLabel, safeText, tagList } from './text';

const isoDate = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO 8601 date-time' })
  .transform((v) => new Date(v));
const capacity = z
  .number()
  .int('Must be an integer')
  .min(0, 'Must be zero or greater')
  .max(100000)
  .nullable();
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((u) => u.startsWith('https://'), 'Must be an https URL')
  .nullable();

const endAfterStart = (v: { startsAt?: Date; endsAt?: Date | null }) =>
  !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt;
const endError = { message: 'endsAt must not be before startsAt', path: ['endsAt'] };

export const createEventSchema = z
  .object({
    title: plainLabel(1, 120),
    description: safeText(1, 5000),
    startsAt: isoDate,
    endsAt: isoDate.nullable().optional(),
    location: plainLabel(1, 200),
    capacity: capacity.optional(),
    waitlistEnabled: z.boolean().default(false),
    imageUrl: imageUrl.optional(),
    tags: tagList.default([]),
  })
  .strict()
  .refine(endAfterStart, endError);

export const updateEventSchema = z
  .object({
    title: plainLabel(1, 120),
    description: safeText(1, 5000),
    startsAt: isoDate,
    endsAt: isoDate.nullable(),
    location: plainLabel(1, 200),
    capacity,
    waitlistEnabled: z.boolean(),
    imageUrl,
    tags: tagList,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update')
  .refine(endAfterStart, endError);

export const rescheduleSchema = z
  .object({ startsAt: isoDate, endsAt: isoDate.nullable().optional() })
  .strict()
  .refine(endAfterStart, endError);

export const eventIdParam = z.object({ eventId: z.string().uuid('Must be a valid event id') });

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const listEventsQuery = z.object({
  q: safeText(1, 100).optional(),
  tag: plainLabel(1, 30)
    .transform((t) => t.toLowerCase())
    .optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  feed: bool.optional(),
  includePassed: bool.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
