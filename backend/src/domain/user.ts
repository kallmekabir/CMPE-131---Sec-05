import type { User } from '@prisma/client';

export interface SelfUser {
  id: string;
  name: string;
  displayName: string;
  universityEmail: string;
  role: User['role'];
  major: string | null;
  interests: string[];
  skills: string[];
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  displayName: string;
  major: string | null;
}

export const toSelfUser = (u: User): SelfUser => ({
  id: u.id,
  name: u.name,
  displayName: u.displayName,
  universityEmail: u.universityEmail,
  role: u.role,
  major: u.major,
  interests: u.interests,
  skills: u.skills,
  emailVerified: u.emailVerified,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

export const toPublicUser = (u: Pick<User, 'id' | 'displayName' | 'major'>): PublicUser => ({
  id: u.id,
  displayName: u.displayName,
  major: u.major,
});
