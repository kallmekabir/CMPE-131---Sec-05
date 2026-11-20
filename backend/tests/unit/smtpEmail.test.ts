import type { Transporter } from 'nodemailer';
import { SmtpEmailAdapter } from '../../src/adapters/email/EmailAdapter';
import { loadConfig } from '../../src/config';

const settings = {
  host: 'smtp.example.com',
  port: 587,
  user: 'u@example.com',
  pass: 'secret',
  from: 'SpartIN <u@example.com>',
};
const message = {
  to: 'a@sjsu.edu',
  displayName: 'Ana\r\nBcc: x@evil.com',
  verificationUrl: 'http://localhost:8081/verify-email?token=abc',
};

describe('SmtpEmailAdapter', () => {
  it('sends the verification link to the recipient', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    await new SmtpEmailAdapter(settings, { sendMail } as unknown as Transporter).sendVerification(
      message,
    );
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe('a@sjsu.edu');
    expect(sent.from).toBe(settings.from);
    expect(sent.text).toContain(message.verificationUrl);
    expect(sent.text).not.toMatch(/Hi Ana\r?\n/); // CR/LF stripped from the display name
  });

  it('turns transport failures into a controlled 503 without leaking details', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('auth failed for secret'));
    const p = new SmtpEmailAdapter(settings, {
      sendMail,
    } as unknown as Transporter).sendVerification(message);
    await expect(p).rejects.toMatchObject({ status: 503 });
    await expect(p).rejects.not.toThrow(/secret/);
  });
});

describe('SMTP config', () => {
  const base = { DATABASE_URL: 'postgresql://x', JWT_ACCESS_SECRET: 'x'.repeat(32) };
  it('is null when unset', () => expect(loadConfig(base).smtp).toBeNull());
  it('is read when complete', () =>
    expect(
      loadConfig({ ...base, SMTP_HOST: 'h', SMTP_USER: 'u@x.com', SMTP_PASS: 'p' }).smtp,
    ).toMatchObject({ host: 'h', port: 587, from: 'SpartIN <u@x.com>' }));
  it('rejects partial settings', () =>
    expect(() => loadConfig({ ...base, SMTP_HOST: 'h' })).toThrow(/together/));
});
