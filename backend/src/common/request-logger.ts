import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const log = new Logger('HTTP');

/**
 * Request logger (Express middleware, so it also sees requests rejected by guards or validation).
 * Logs method, path, final status, duration and user id once the response is sent.
 * Never logs bodies, headers, tokens or signed-URL parameters.
 */
export function requestLogger(req: Request & { user?: { id: string } }, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test') return next();
  const started = Date.now();
  res.once('finish', () => {
    const path = req.path.startsWith('/api/v1/media/') ? '/api/v1/media/…' : req.path;
    const line = `${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms${req.user ? ` user=${req.user.id}` : ''}`;
    if (res.statusCode >= 500) log.warn(line); else log.log(line);
  });
  next();
}
