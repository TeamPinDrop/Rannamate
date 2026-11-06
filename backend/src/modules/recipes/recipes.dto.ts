import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PageQuery } from '../../common/utils/pagination';
import { CUISINES, DIETS, DIFFICULTIES, MOODS } from '../../domain/types';

export class RecipeQueryDto extends PageQuery {
  @ApiPropertyOptional({ description: 'Search name, tagline, cuisine, mood and ingredients' })
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(80) q?: string;
  @ApiPropertyOptional({ enum: CUISINES }) @IsOptional() @IsIn(CUISINES) cuisine?: string;
  @ApiPropertyOptional({ description: 'Maximum total minutes (prep + cook)' }) @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(600) maxTime?: number;
  @ApiPropertyOptional({ enum: DIFFICULTIES }) @IsOptional() @IsIn(DIFFICULTIES) difficulty?: string;
  @ApiPropertyOptional({ enum: DIETS }) @IsOptional() @IsIn(DIETS) diet?: string;
  @ApiPropertyOptional({ enum: MOODS, description: 'Food type / mood (the frontend has no separate meal-type field)' }) @IsOptional() @IsIn(MOODS) mood?: string;
}
