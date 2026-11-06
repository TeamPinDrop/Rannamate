import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ALLERGENS, CUISINES, DIETS, DIFFICULTIES, EQUIPMENT, MOODS } from '../../domain/types';

export class RecommendDto {
  @ApiPropertyOptional({ description: 'Ingredient ids you have. If omitted and you are signed in, your saved kitchen inventory is used.', isArray: true, type: String })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ArrayUnique() @IsString({ each: true }) @MaxLength(60, { each: true }) ingredientIds?: string[];

  @ApiPropertyOptional({ enum: MOODS, isArray: true }) @IsOptional() @IsArray() @IsIn(MOODS, { each: true }) moods?: string[];
  @ApiPropertyOptional({ enum: CUISINES, isArray: true }) @IsOptional() @IsArray() @IsIn(CUISINES, { each: true }) cuisines?: string[];
  @ApiPropertyOptional({ description: 'Free-text craving, e.g. "something spicy with paneer"' }) @IsOptional() @IsString() @MaxLength(120) craving?: string;
  @ApiPropertyOptional({ description: 'Max total minutes' }) @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(600) maxTime?: number;
  @ApiPropertyOptional({ enum: DIFFICULTIES, isArray: true }) @IsOptional() @IsArray() @IsIn(DIFFICULTIES, { each: true }) difficulty?: string[];
  @ApiPropertyOptional({ enum: EQUIPMENT, isArray: true, description: 'Equipment you own (hard requirement when given)' }) @IsOptional() @IsArray() @IsIn(EQUIPMENT, { each: true }) equipment?: (typeof EQUIPMENT)[number][];
  @ApiPropertyOptional({ enum: DIETS, isArray: true, description: 'Hard dietary restrictions (merged with your profile)' }) @IsOptional() @IsArray() @IsIn(DIETS, { each: true }) diets?: (typeof DIETS)[number][];
  @ApiPropertyOptional({ enum: ALLERGENS, isArray: true, description: 'Allergies (merged with your profile; always hard exclusions)' }) @IsOptional() @IsArray() @IsIn(ALLERGENS, { each: true }) allergies?: (typeof ALLERGENS)[number][];
  @ApiPropertyOptional({ enum: ['hot', 'cold'] }) @IsOptional() @IsIn(['hot', 'cold']) weather?: 'hot' | 'cold';
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 12 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @ApiPropertyOptional({ description: 'Include the list of excluded recipes with reasons', default: false }) @IsOptional() @IsBoolean() includeExcluded?: boolean;
}
