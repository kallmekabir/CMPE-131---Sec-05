import type { AuthContext } from '../domain/auth';

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
    }
  }
}

export {};
