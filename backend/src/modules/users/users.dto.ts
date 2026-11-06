import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ALLERGENS, DIETS, LANGS, PERSONAS } from '../../domain/types';

/** Only fields the approved frontend actually has (Profile page + Cooking Mate preferences). */
export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(1) @MaxLength(60)
  displayName?: string;

  @ApiPropertyOptional({ enum: ALLERGENS, isArray: true }) @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(ALLERGENS.length) @IsIn(ALLERGENS, { each: true })
  allergies?: (typeof ALLERGENS)[number][];

  @ApiPropertyOptional({ enum: DIETS, isArray: true }) @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(DIETS.length) @IsIn(DIETS, { each: true })
  diets?: (typeof DIETS)[number][];

  @ApiPropertyOptional({ enum: LANGS }) @IsOptional() @IsIn(LANGS) preferredLanguage?: (typeof LANGS)[number];
  @ApiPropertyOptional({ enum: PERSONAS }) @IsOptional() @IsIn(PERSONAS) matePersona?: (typeof PERSONAS)[number];
}
