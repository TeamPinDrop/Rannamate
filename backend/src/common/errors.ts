import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Every error the API returns has a stable machine-readable `code`
 * so the frontend can react without parsing messages.
 */
export class AppError extends HttpException {
  constructor(status: HttpStatus, public readonly code: string, message: string, public readonly details?: unknown) {
    super({ code, message, details }, status);
  }
}

export const Errors = {
  notFound: (what: string) => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} not found`),
  conflict: (code: string, message: string, details?: unknown) => new AppError(HttpStatus.CONFLICT, code, message, details),
  badRequest: (code: string, message: string, details?: unknown) => new AppError(HttpStatus.BAD_REQUEST, code, message, details),
  unauthorized: (code = 'UNAUTHORIZED', message = 'Authentication required') => new AppError(HttpStatus.UNAUTHORIZED, code, message),
  forbidden: (message = 'You do not have access to this resource') => new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', message),
  payloadTooLarge: (message: string) => new AppError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', message),
  unsupportedMedia: (message: string) => new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_MEDIA_TYPE', message),
  unavailable: (code: string, message: string) => new AppError(HttpStatus.SERVICE_UNAVAILABLE, code, message),
  badGateway: (code: string, message: string) => new AppError(HttpStatus.BAD_GATEWAY, code, message),
};

/** Raised by database repositories that cannot run yet. Never swallowed or replaced with fake data. */
export class DatabaseUnavailableError extends AppError {
  constructor(kind: 'DATABASE_NOT_CONFIGURED' | 'SCHEMA_NOT_VERIFIED', area: string) {
    super(
      HttpStatus.SERVICE_UNAVAILABLE,
      kind,
      kind === 'DATABASE_NOT_CONFIGURED'
        ? `The MySQL connection is not configured yet, so ${area} is unavailable. Set DB_* in backend/.env (or DATA_SOURCE=memory for local development).`
        : `The ${area} tables of the ranna_mate database have not been mapped yet, so this endpoint cannot run against MySQL. See backend/docs/DATABASE_MAPPING.md.`,
    );
  }
}
