import { dependencyUnavailable } from '../../errors/AppError';

export interface VerificationEmail {
  to: string;
  displayName: string;
  verificationUrl: string;
}

export interface EmailAdapter {
  sendVerification(message: VerificationEmail): Promise<void>;
}

/** Default until a real provider is wired in; fails with a controlled 503-class error. */
export class UnconfiguredEmailAdapter implements EmailAdapter {
  async sendVerification(): Promise<void> {
    throw dependencyUnavailable('Email service');
  }
}

export class InMemoryEmailAdapter implements EmailAdapter {
  readonly sent: VerificationEmail[] = [];
  failWith: Error | null = null;

  async sendVerification(message: VerificationEmail): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }
}
