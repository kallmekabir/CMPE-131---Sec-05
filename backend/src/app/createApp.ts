import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { Config } from '../config';
import type { Db } from '../db/client';
import type { Logger } from '../logging/logger';
import { requestId } from '../middleware/requestId';
import { createErrorHandler, notFoundHandler } from '../errors/errorHandler';
import { healthRouter } from '../routes/health';
import { authRouter } from '../routes/auth';
import { AuthController } from '../controllers/authController';
import { AuthService } from '../services/authService';
import { TokenService } from '../services/tokenService';
import { UserRepository } from '../repositories/userRepository';
import { TokenRepository } from '../repositories/tokenRepository';
import { GoogleMapsLinkAdapter } from '../adapters/maps/MapAdapter';
import { StandardCalendarAdapter } from '../adapters/calendar/CalendarAdapter';
import { AppLinkSharingAdapter } from '../adapters/sharing/SharingAdapter';
import { IntegrationService, type IntegrationAdapters } from '../services/integrationService';
import { IntegrationController } from '../controllers/integrationController';
import { recommendationRouter } from '../routes/recommendations';
import { eventRouter } from '../routes/events';
import { userRouter } from '../routes/users';
import { EventController } from '../controllers/eventController';
import { UserController } from '../controllers/userController';
import { EventService } from '../services/eventService';
import { ParticipationService } from '../services/participationService';
import { UserService } from '../services/userService';
import { EventCardBuilder } from '../services/eventCards';
import { EventRepository } from '../repositories/eventRepository';
import { ParticipationRepository } from '../repositories/participationRepository';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimit';
import {
  createDevAuthProvider,
  createLocalAuthProvider,
} from '../adapters/authentication/AuthProvider';
import { UnconfiguredEmailAdapter, type EmailAdapter } from '../adapters/email/EmailAdapter';

export interface AppDeps {
  config: Config;
  db: Db;
  logger: Logger;
  email?: EmailAdapter;
  integrations?: Partial<IntegrationAdapters>;
}

export function createApp(deps: AppDeps) {
  const { config, db, logger } = deps;
  const users = new UserRepository(db);
  const tokens = new TokenRepository(db);
  const tokenService = new TokenService({
    secret: config.jwtAccessSecret,
    accessTtlSeconds: config.accessTokenTtlSeconds,
  });
  const authService = new AuthService({
    users,
    tokens,
    tokenService,
    provider: config.authProvider === 'dev' ? createDevAuthProvider() : createLocalAuthProvider(),
    email: deps.email ?? new UnconfiguredEmailAdapter(),
    logger,
    allowedEmailDomains: config.allowedEmailDomains,
    refreshTtlSeconds: config.refreshTokenTtlSeconds,
    publicAppUrl: config.publicAppUrl,
  });
  const requireAuth = authenticate(tokenService);
  const eventRepo = new EventRepository(db);
  const participationRepo = new ParticipationRepository(db);
  const cards = new EventCardBuilder(eventRepo, participationRepo);
  const eventService = new EventService(eventRepo, participationRepo, cards);
  const participationService = new ParticipationService(eventRepo, participationRepo, eventService);
  const integrationController = new IntegrationController(
    new IntegrationService(
      eventService,
      users,
      {
        maps: deps.integrations?.maps ?? new GoogleMapsLinkAdapter(),
        calendar: deps.integrations?.calendar ?? new StandardCalendarAdapter(),
        sharing: deps.integrations?.sharing ?? new AppLinkSharingAdapter(config.publicAppUrl),
      },
      logger,
    ),
  );
  const userService = new UserService(users, eventRepo, participationRepo, cards);
  const apiLimiter = createRateLimiter(config.apiRateLimitMax, 60 * 1000);
  const app = express();

  app.disable('x-powered-by');
  if (config.env === 'production') app.set('trust proxy', 1);

  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter(db));
  app.use(
    '/api/auth',
    authRouter(
      new AuthController(authService),
      requireAuth,
      createRateLimiter(config.authRateLimitMax),
    ),
  );

  app.use('/api/users', apiLimiter, userRouter(new UserController(userService), requireAuth));
  app.use(
    '/api/events',
    apiLimiter,
    eventRouter(
      new EventController(eventService, participationService),
      integrationController,
      requireAuth,
    ),
  );

  app.use(
    '/api/recommendations',
    apiLimiter,
    recommendationRouter(integrationController, requireAuth),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger, config.env === 'production'));
  return app;
}
