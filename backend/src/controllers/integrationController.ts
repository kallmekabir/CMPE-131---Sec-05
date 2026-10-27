import type { Request, Response } from 'express';
import type { IntegrationService } from '../services/integrationService';
import { parse } from '../middleware/validate';
import { eventIdParam, pageQuery } from '../validators/event';

export class IntegrationController {
  constructor(private readonly integrations: IntegrationService) {}

  private id(req: Request) {
    return parse(eventIdParam, req.params).eventId;
  }

  map = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.integrations.map(req.auth!, this.id(req)) });
  };

  navigation = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.integrations.navigation(req.auth!, this.id(req)) });
  };

  share = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.integrations.share(req.auth!, this.id(req)) });
  };

  calendar = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.integrations.calendar(req.auth!, this.id(req)) });
  };

  recommendations = async (req: Request, res: Response) => {
    const { limit } = parse(pageQuery, req.query);
    res.json({
      success: true,
      data: await this.integrations.recommendations(req.auth!, limit),
    });
  };
}
