import type { Request, Response } from 'express';
import type { EventService } from '../services/eventService';
import type { ParticipationService } from '../services/participationService';
import { parse } from '../middleware/validate';
import {
  createEventSchema,
  eventIdParam,
  listEventsQuery,
  pageQuery,
  rescheduleSchema,
  updateEventSchema,
} from '../validators/event';

export class EventController {
  constructor(
    private readonly events: EventService,
    private readonly participation: ParticipationService,
  ) {}

  private id(req: Request) {
    return parse(eventIdParam, req.params).eventId;
  }

  list = async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: await this.events.list(req.auth!, parse(listEventsQuery, req.query)),
    });
  };

  get = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.events.get(req.auth!, this.id(req)) });
  };

  create = async (req: Request, res: Response) => {
    const data = await this.events.create(req.auth!, parse(createEventSchema, req.body));
    res.status(201).json({ success: true, data });
  };

  update = async (req: Request, res: Response) => {
    const data = await this.events.update(
      req.auth!,
      this.id(req),
      parse(updateEventSchema, req.body),
    );
    res.json({ success: true, data });
  };

  reschedule = async (req: Request, res: Response) => {
    const data = await this.events.reschedule(
      req.auth!,
      this.id(req),
      parse(rescheduleSchema, req.body),
    );
    res.json({ success: true, data });
  };

  remove = async (req: Request, res: Response) => {
    await this.events.remove(req.auth!, this.id(req));
    res.status(204).end();
  };

  participants = async (req: Request, res: Response) => {
    const { limit } = parse(pageQuery, req.query);
    res.json({
      success: true,
      data: await this.events.participants(req.auth!, this.id(req), limit),
    });
  };

  join = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.participation.join(req.auth!, this.id(req)) });
  };

  leave = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.participation.leave(req.auth!, this.id(req)) });
  };

  pass = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.participation.pass(req.auth!, this.id(req)) });
  };

  status = async (req: Request, res: Response) => {
    res.json({ success: true, data: await this.participation.status(req.auth!, this.id(req)) });
  };
}
