import type { Request, Response } from 'express';
import type { UserService } from '../services/userService';
import { parse } from '../middleware/validate';
import { pageQuery } from '../validators/event';
import { updateProfileSchema } from '../validators/user';

export class UserController {
  constructor(private readonly users: UserService) {}

  me = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.users.getProfile(req.auth!.userId) });
  };

  update = async (req: Request, res: Response) => {
    const data = await this.users.updateProfile(
      req.auth!.userId,
      parse(updateProfileSchema, req.body),
    );
    res.json({ success: true, data });
  };

  events = async (req: Request, res: Response) => {
    const { limit } = parse(pageQuery, req.query);
    res.json({ success: true, data: await this.users.myEvents(req.auth!.userId, limit) });
  };

  participation = async (req: Request, res: Response) => {
    const { limit } = parse(pageQuery, req.query);
    res.json({ success: true, data: await this.users.myParticipation(req.auth!.userId, limit) });
  };
}
