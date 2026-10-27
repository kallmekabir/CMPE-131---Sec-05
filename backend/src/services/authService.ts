import type { AuthProvider } from '../adapters/authentication/AuthProvider';
import type { EmailAdapter } from '../adapters/email/EmailAdapter';
import { isApprovedUniversityEmail, normalizeEmail } from '../domain/email';
import { toSelfUser } from '../domain/user';
import { AppError, conflict, invalidToken, unauthenticated } from '../errors/AppError';
import type { Logger } from '../logging/logger';
import type { TokenRepository } from '../repositories/tokenRepository';
import type { UserRepository } from '../repositories/userRepository';
import { generateOpaqueToken, hashOpaqueToken, type TokenService } from './tokenService';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export interface AuthServiceDeps {
  users: UserRepository;
  tokens: TokenRepository;
  tokenService: TokenService;
  provider: AuthProvider;
  email: EmailAdapter;
  logger: Logger;
  allowedEmailDomains: string[];
  refreshTtlSeconds: number;
  publicAppUrl: string;
  now?: () => Date;
}

export class AuthService {
  constructor(private readonly d: AuthServiceDeps) {}

  private now() {
    return this.d.now ? this.d.now() : new Date();
  }

  async register(input: {
    name: string;
    displayName?: string;
    universityEmail: string;
    password: string;
    major?: string;
  }) {
    const email = normalizeEmail(input.universityEmail);
    if (!isApprovedUniversityEmail(email, this.d.allowedEmailDomains)) {
      throw new AppError('EMAIL_NOT_ALLOWED', 400, 'Use an approved university email address.', {
        fields: { universityEmail: ['Must be an approved university email address'] },
      });
    }
    if (await this.d.users.findByEmail(email)) {
      throw conflict('An account with this email already exists.');
    }

    const passwordHash = await this.d.provider.hashPassword(input.password);
    let user;
    try {
      user = await this.d.users.create({
        name: input.name,
        displayName: input.displayName ?? input.name,
        universityEmail: email,
        passwordHash,
        major: input.major,
        role: 'PARTICIPANT',
        emailVerified: this.d.provider.autoVerifyEmail,
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw conflict('An account with this email already exists.');
      }
      throw err;
    }

    let verificationEmailSent = this.d.provider.autoVerifyEmail;
    if (!user.emailVerified) {
      verificationEmailSent = await this.sendVerification(user.id, user.displayName, email);
    }
    return { user: toSelfUser(user), verificationEmailSent };
  }

  private async sendVerification(userId: string, displayName: string, to: string) {
    const token = generateOpaqueToken();
    await this.d.tokens.createVerificationToken(
      userId,
      hashOpaqueToken(token),
      new Date(this.now().getTime() + VERIFICATION_TTL_MS),
    );
    try {
      await this.d.email.sendVerification({
        to,
        displayName,
        verificationUrl: `${this.d.publicAppUrl}/verify-email?token=${token}`,
      });
      return true;
    } catch (err) {
      // The account stays usable for re-sending later; registration must not fail on email outages.
      this.d.logger.warn({ userId, err: (err as Error).message }, 'verification email failed');
      return false;
    }
  }

  async verifyEmail(token: string) {
    const userId = await this.d.tokens.consumeVerificationToken(hashOpaqueToken(token), this.now());
    if (!userId) throw invalidToken();
    return { verified: true };
  }

  async login(input: { universityEmail: string; password: string }) {
    const user = await this.d.users.findByEmail(normalizeEmail(input.universityEmail));
    const valid = await this.d.provider.verifyPassword(input.password, user?.passwordHash ?? null);
    if (!user || !valid) throw unauthenticated('Invalid email or password.');
    if (!user.emailVerified) {
      throw new AppError(
        'EMAIL_NOT_VERIFIED',
        403,
        'Verify your university email before logging in.',
      );
    }
    return this.issueSession(user.id, user.role, toSelfUser(user));
  }

  async refresh(refreshToken: string) {
    const hash = hashOpaqueToken(refreshToken);
    const stored = await this.d.tokens.findRefreshToken(hash);
    if (!stored || stored.revokedAt || stored.expiresAt <= this.now()) throw invalidToken();
    const user = await this.d.users.findById(stored.userId);
    if (!user) throw invalidToken();
    // Only one concurrent caller wins the revoke, so a refresh token cannot be replayed.
    if (!(await this.d.tokens.revokeRefreshToken(hash))) throw invalidToken();
    return this.issueSession(user.id, user.role, toSelfUser(user));
  }

  async logout(refreshToken: string) {
    await this.d.tokens.revokeRefreshToken(hashOpaqueToken(refreshToken));
  }

  async me(userId: string) {
    const user = await this.d.users.findById(userId);
    if (!user) throw unauthenticated();
    return toSelfUser(user);
  }

  private async issueSession(userId: string, role: 'PARTICIPANT' | 'ORGANIZER', user: unknown) {
    const refreshToken = generateOpaqueToken();
    await this.d.tokens.createRefreshToken(
      userId,
      hashOpaqueToken(refreshToken),
      new Date(this.now().getTime() + this.d.refreshTtlSeconds * 1000),
    );
    return {
      accessToken: this.d.tokenService.signAccessToken({ userId, role }),
      refreshToken,
      expiresIn: this.d.tokenService.accessTtlSeconds,
      user,
    };
  }
}
