import type { Request, Response } from 'express';
import type { AuthService } from '../services/authService';
import { loginSchema, refreshSchema, registerSchema, verifyEmailSchema } from '../validators/auth';
import { parse } from '../middleware/validate';
import { unauthenticated } from '../errors/AppError';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (req: Request, res: Response) => {
    const result = await this.auth.register(parse(registerSchema, req.body));
    res.status(201).json({
      success: true,
      data: result,
      message: result.verificationEmailSent
        ? 'Account created.'
        : 'Account created, but the verification email could not be sent.',
    });
  };

  login = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.auth.login(parse(loginSchema, req.body)) });
  };

  verifyEmail = async (req: Request, res: Response) => {
    const { token } = parse(verifyEmailSchema, req.body);
    res.json({ success: true, data: await this.auth.verifyEmail(token) });
  };

  refresh = async (req: Request, res: Response) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    res.json({ success: true, data: await this.auth.refresh(refreshToken) });
  };

  logout = async (req: Request, res: Response) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    await this.auth.logout(refreshToken);
    res.status(204).end();
  };

  me = async (req: Request, res: Response) => {
    if (!req.auth) throw unauthenticated();
    res.json({ success: true, data: await this.auth.me(req.auth.userId) });
  };
}
