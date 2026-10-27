import { z } from 'zod';

const password = z.string().min(10, 'Password must be at least 10 characters').max(72);
const email = z.string().trim().max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(50).optional(),
  universityEmail: email,
  password,
  major: z.string().trim().max(100).optional(),
});

export const loginSchema = z.object({
  universityEmail: email,
  password: z.string().min(1).max(72),
});

export const verifyEmailSchema = z.object({ token: z.string().min(1).max(200) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(200) });
