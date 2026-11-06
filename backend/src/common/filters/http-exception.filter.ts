import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 405: 'METHOD_NOT_ALLOWED', 409: 'CONFLICT',
  413: 'FILE_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA_TYPE', 422: 'UNPROCESSABLE_ENTITY', 429: 'RATE_LIMITED', 502: 'BAD_GATEWAY', 503: 'SERVICE_UNAVAILABLE',
};

/**
 * One error shape for the whole API:
 *   { error: { code, message, details? }, statusCode, path, timestamp }
 * Unexpected errors are logged server-side and returned as a generic 500 — no stack traces or internals leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong on our side.';
    let details: unknown;

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'RATE_LIMITED';
      message = 'Too many requests — please slow down and try again shortly.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as string | { code?: string; message?: string | string[]; details?: unknown };
      code = DEFAULT_CODES[status] ?? 'ERROR';
      if (typeof body === 'string') message = body;
      else {
        if (body.code) code = body.code;
        if (Array.isArray(body.message)) {
          // class-validator messages
          code = 'VALIDATION_FAILED';
          message = 'Some fields are invalid.';
          details = body.message;
        } else if (body.message) message = body.message;
        if (body.details !== undefined) details = body.details;
      }
      // multer limits arrive as generic 413/400 messages
      if (status === 413) code = 'FILE_TOO_LARGE';
    } else if (dbProblem(exception)) {
      // MySQL down / wrong credentials / schema differs: an honest 503, never fake data; details stay in the server log
      const p = dbProblem(exception)!;
      this.log.error(`${req.method} ${req.path} → MySQL ${(exception as { code?: string }).code}: ${(exception as Error).message}`);
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = p.code;
      message = p.message;
    } else {
      const e = exception as Error;
      this.log.error(`${req.method} ${req.path} → ${e?.name}: ${e?.message}`, e?.stack);
    }

    res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) }, statusCode: status, path: req.path, timestamp: new Date().toISOString() });
  }
}

const DB_DOWN = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_CON_COUNT_ERROR']);
const DB_SCHEMA = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_COLUMNACCESS_DENIED_ERROR']);
function dbProblem(e: unknown): { code: string; message: string } | null {
  const c = (e as { code?: string })?.code;
  if (!c) return null;
  if (DB_DOWN.has(c)) return { code: 'DATABASE_UNAVAILABLE', message: "Can't reach the database right now. Please try again shortly." };
  if (DB_SCHEMA.has(c)) return { code: 'SCHEMA_MISMATCH', message: "The database structure doesn't match what this server expects." };
  return null;
}
