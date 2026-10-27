import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthContext, UserRole } from '../domain/auth';
import { invalidToken, tokenExpired } from '../errors/AppError';

export interface TokenServiceOptions {
  secret: string;
  accessTtlSeconds: number;
  now?: () => number;
}

export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  signAccessToken(ctx: AuthContext): string {
    return jwt.sign({ role: ctx.role }, this.options.secret, {
      algorithm: 'HS256',
      subject: ctx.userId,
      expiresIn: this.options.accessTtlSeconds,
    });
  }

  verifyAccessToken(token: string): AuthContext {
    try {
      const payload = jwt.verify(token, this.options.secret, {
        algorithms: ['HS256'],
        ...(this.options.now ? { clockTimestamp: Math.floor(this.options.now() / 1000) } : {}),
      }) as jwt.JwtPayload;
      if (!payload.sub || (payload.role !== 'PARTICIPANT' && payload.role !== 'ORGANIZER')) {
        throw invalidToken();
      }
      return { userId: payload.sub, role: payload.role as UserRole };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw tokenExpired();
      throw invalidToken();
    }
  }

  get accessTtlSeconds() {
    return this.options.accessTtlSeconds;
  }
}

export const generateOpaqueToken = () => randomBytes(32).toString('base64url');
export const hashOpaqueToken = (token: string) => createHash('sha256').update(token).digest('hex');
