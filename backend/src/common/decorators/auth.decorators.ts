import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const OPTIONAL_AUTH = 'optionalAuth';
/** No token needed. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Works without a token, but uses the user's profile when a valid one is sent. */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH, true);

export interface AuthUser { id: string; email: string; sessionId?: string }

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest().user);
