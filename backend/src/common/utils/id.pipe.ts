import { Injectable, PipeTransform } from '@nestjs/common';
import { Errors } from '../errors';

/** Accepts UUIDs (memory store) and numeric / slug ids (MySQL keys once mapped). */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  transform(v: string) {
    if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v)) throw Errors.badRequest('INVALID_ID', 'Invalid id.');
    return v;
  }
}
