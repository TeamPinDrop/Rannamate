import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Paginated } from '../utils/pagination';

/** Wraps every successful JSON response as `{ data }` (plus `meta` for paginated lists). */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value instanceof StreamableFile || value === undefined) return value;
        if (value instanceof Paginated) return { data: value.items, meta: value.meta };
        return { data: value };
      }),
    );
  }
}
