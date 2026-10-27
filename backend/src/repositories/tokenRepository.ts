import type { Db } from '../db/client';

export class TokenRepository {
  constructor(private readonly db: Db) {}

  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findRefreshToken(tokenHash: string) {
    return this.db.refreshToken.findUnique({ where: { tokenHash } });
  }

  /** Returns true only for the caller that actually revoked it, so a token can be rotated once. */
  async revokeRefreshToken(tokenHash: string): Promise<boolean> {
    const result = await this.db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  createVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  async consumeVerificationToken(tokenHash: string, now: Date) {
    return this.db.$transaction(async (tx) => {
      const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash } });
      if (!token || token.consumedAt || token.expiresAt <= now) return null;
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) return null;
      await tx.user.update({ where: { id: token.userId }, data: { emailVerified: true } });
      return token.userId;
    });
  }
}
