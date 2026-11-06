import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  pageSize = 20;
}

export interface PageMeta { page: number; pageSize: number; total: number; totalPages: number }

export class Paginated<T> {
  readonly meta: PageMeta;
  constructor(public readonly items: T[], total: number, page: number, pageSize: number) {
    this.meta = { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  static of<T>(all: T[], page: number, pageSize: number) {
    return new Paginated(all.slice((page - 1) * pageSize, page * pageSize), all.length, page, pageSize);
  }
}
