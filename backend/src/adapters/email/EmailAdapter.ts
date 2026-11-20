import { createTransport, type Transporter } from 'nodemailer';
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

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/** Sends the verification link over SMTP (e.g. Gmail with an app password). Failures become a controlled 503. */
export class SmtpEmailAdapter implements EmailAdapter {
  private readonly transport: Transporter;

  constructor(
    private readonly settings: SmtpSettings,
    transport?: Transporter,
  ) {
    this.transport =
      transport ??
      createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.port === 465,
        auth: { user: settings.user, pass: settings.pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
      });
  }

  async sendVerification(message: VerificationEmail): Promise<void> {
    const name = message.displayName.replace(/[\r\n]/g, ' ');
    try {
      await this.transport.sendMail({
        from: this.settings.from,
        to: message.to,
        subject: 'Verify your SpartIN email',
        text: `Hi ${name},\n\nConfirm your SJSU email to start using SpartIN:\n${message.verificationUrl}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`,
      });
    } catch {
      throw dependencyUnavailable('Email service');
    }
  }
}
