import bcrypt from 'bcryptjs';

export interface AuthProvider {
  readonly name: string;
  readonly autoVerifyEmail: boolean;
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string | null): Promise<boolean>;
}

// Placeholder hash so unknown-email logins spend the same time as wrong-password logins.
const TIMING_DECOY = bcrypt.hashSync('decoy-password', 4);

class BcryptProvider implements AuthProvider {
  constructor(
    readonly name: string,
    readonly autoVerifyEmail: boolean,
    private readonly cost: number,
  ) {}

  hashPassword(plain: string) {
    return bcrypt.hash(plain, this.cost);
  }

  async verifyPassword(plain: string, hash: string | null) {
    const ok = await bcrypt.compare(plain, hash ?? TIMING_DECOY);
    return hash !== null && ok;
  }
}

/**
 * Production-shaped provider: emails must be verified before login. Replace for DUO/SSO.
 * `autoVerifyEmail` is the explicit BETA_SKIP_EMAIL_VERIFICATION opt-in: strong password hashing stays, but anyone
 * who registers with an approved domain is treated as verified. Do not enable once an email provider works.
 */
export const createLocalAuthProvider = (autoVerifyEmail = false): AuthProvider =>
  new BcryptProvider('local', autoVerifyEmail, 12);

/** Development/test only (config rejects it in production): low bcrypt cost, emails auto-verified. */
export const createDevAuthProvider = (): AuthProvider => new BcryptProvider('dev', true, 4);
