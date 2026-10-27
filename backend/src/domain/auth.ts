export const USER_ROLES = ['PARTICIPANT', 'ORGANIZER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthContext {
  userId: string;
  role: UserRole;
}
