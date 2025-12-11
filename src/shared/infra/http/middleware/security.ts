import helmet from 'helmet';
import express from 'express';

const security = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const helmetConfig = {
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'connect-src': ["'self'", 'https:'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'media-src': ["'self'", 'data:', 'blob:'],
        upgradeInsecureRequests: null,
      },
    },
    xssFilter: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    frameguard: {
      action: 'sameorigin' as const,
    },
  };

  helmet(helmetConfig)(req, res, next);
};

export default security;
