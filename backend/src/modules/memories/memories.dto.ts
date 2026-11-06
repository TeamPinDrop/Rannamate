import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { PageQuery } from '../../common/utils/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** multipart sends everything as strings — accept a JSON array, a comma list, or a real array */
const toTags = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return value === '' ? [] : value;
  let arr: unknown = value;
  if (typeof value === 'string') { try { arr = JSON.parse(value); } catch { arr = value.split(','); } }
  return Array.isArray(arr) ? [...new Set(arr.map((t) => String(t).trim().replace(/^#/, '').toLowerCase()).filter(Boolean))] : arr;
};
const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
const toRating = ({ value }: { value: unknown }) => (value === null || value === '' || value === 'null' ? null : value === undefined ? undefined : Number(value));

export class MemoryFieldsDto {
  @ApiPropertyOptional({ example: '2026-10-30', description: 'Cooking date (YYYY-MM-DD), not in the future' })
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }) date?: string;
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @Transform(trim) @IsString() @MaxLength(160) caption?: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true }) @IsOptional() @Transform(toRating) @ValidateIf((_o, v) => v !== null) @IsInt() @Min(1) @Max(5) rating?: number | null;
  @ApiPropertyOptional({ type: [String], maxItems: 10 }) @IsOptional() @Transform(toTags) @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(24, { each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() favourite?: boolean;
  @ApiPropertyOptional({ nullable: true, description: 'Optional linked recipe id' }) @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @MaxLength(80) recipeId?: string | null;
}

export class CreateMemoryDto extends MemoryFieldsDto {
  @ApiProperty({ example: "Grandma's rajma chawal" }) @Transform(trim) @IsString() @MinLength(1, { message: 'Give your dish a name' }) @MaxLength(80) dish: string;
}
export class UpdateMemoryDto extends MemoryFieldsDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) dish?: string;
}

export class MemoryQueryDto extends PageQuery {
  @ApiPropertyOptional({ description: 'Searches dish, caption, notes and tags' }) @IsOptional() @IsString() @MaxLength(80) q?: string;
  @ApiPropertyOptional({ enum: ['all', 'favourites', 'recent', 'top'], default: 'all', description: 'recent = added in the last 30 days; top = rated 4+' }) @IsOptional() @IsIn(['all', 'favourites', 'recent', 'top']) filter: 'all' | 'favourites' | 'recent' | 'top' = 'all';
  @ApiPropertyOptional({ enum: ['newest', 'oldest', 'rating', 'az'], default: 'newest' }) @IsOptional() @IsIn(['newest', 'oldest', 'rating', 'az']) sort: 'newest' | 'oldest' | 'rating' | 'az' = 'newest';
}

export class FavouriteDto { @ApiPropertyOptional({ description: 'Omit to toggle' }) @IsOptional() @IsBoolean() favourite?: boolean }
export class CoverDto { @ApiProperty() @IsString() @MaxLength(64) photoId: string }
export class ReorderDto { @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ArrayUnique() @IsString({ each: true }) photoIds: string[] }
export class MediaQuery { @Type(() => String) @IsString() exp: string; @IsString() @MaxLength(128) sig: string }
