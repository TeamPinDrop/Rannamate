import { Body, Controller, HttpCode, Inject, Injectable, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { perMinute } from '../../common/utils/rate-limit';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CurrentUser, OptionalAuth, type AuthUser } from '../../common/decorators/auth.decorators';
import { Errors } from '../../common/errors';
import { REPO, type IngredientsRepository, type RecipesRepository, type UsersRepository } from '../../database/repositories';
import { ALLERGENS, DIETS, LANGS, PERSONAS } from '../../domain/types';
import { AiServiceClient } from '../../integrations/ai-service/ai.client';

class Turn { @IsIn(['user', 'mate']) who: 'user' | 'mate'; @IsString() @MaxLength(1000) text: string }

export class MateChatDto {
  @ApiProperty({ example: 'How do I know the onions are golden?' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(1) @MaxLength(500) message: string;
  @ApiPropertyOptional({ example: 'dal-tadka' }) @IsOptional() @IsString() @MaxLength(80) recipeId?: string;
  @ApiPropertyOptional({ description: '0-based current step' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) stepIndex?: number;
  @ApiPropertyOptional({ type: [Turn], description: 'Recent conversation (last 12 turns are used)' }) @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => Turn) history?: Turn[];
  @ApiPropertyOptional({ enum: PERSONAS }) @IsOptional() @IsIn(PERSONAS) persona?: string;
  @ApiPropertyOptional({ enum: LANGS }) @IsOptional() @IsIn(LANGS) lang?: string;
  @ApiPropertyOptional({ enum: ALLERGENS, isArray: true, description: 'Used when not signed in' }) @IsOptional() @IsArray() @IsIn(ALLERGENS, { each: true }) allergies?: string[];
  @ApiPropertyOptional({ enum: DIETS, isArray: true }) @IsOptional() @IsArray() @IsIn(DIETS, { each: true }) diets?: string[];
}

export interface MateReply { reply: string; action: 'next' | 'prev' | 'repeat' | 'start-timer' | 'pause-timer' | null; goToStep: number | null; timerSeconds: number | null; swap: { from: string; options: string[] } | null }

/** Builds a compact recipe context (not the database) and asks the AI service. */
@Injectable()
export class CookingMateService {
  constructor(
    private readonly ai: AiServiceClient,
    @Inject(REPO.recipes) private readonly recipes: RecipesRepository,
    @Inject(REPO.ingredients) private readonly ingredients: IngredientsRepository,
    @Inject(REPO.users) private readonly users: UsersRepository,
  ) {}

  async chat(dto: MateChatDto, userId?: string) {
    const profile = userId ? await this.users.getProfile(userId) : null;
    let recipe: unknown = null;
    if (dto.recipeId) {
      const r = await this.recipes.findById(dto.recipeId);
      if (!r) throw Errors.notFound('Recipe');
      if (dto.stepIndex !== undefined && dto.stepIndex >= r.steps.length) throw Errors.badRequest('STEP_OUT_OF_RANGE', `This recipe has ${r.steps.length} steps.`);
      const ing = new Map((await this.ingredients.findByIds(r.ingredients.map((i) => i.ingredientId))).map((i) => [i.id, i.name]));
      recipe = {
        name: r.name, servings: r.servings, cuisine: r.cuisine,
        ingredients: r.ingredients.map((i) => `${ing.get(i.ingredientId) ?? i.ingredientId} ${i.quantity} ${i.unit}${i.optional ? ' (optional)' : ''}${i.note ? ` — ${i.note}` : ''}`),
        steps: r.steps.map((s) => ({ text: s.text, timerSeconds: s.timer ?? null, tip: s.tip ?? null })),
        substitutions: r.substitutions.map((s) => `${ing.get(s.ingredientId) ?? s.ingredientId} → ${s.options.join(' / ')}`),
      };
    }
    const out = await this.ai.postJson<MateReply>('/v1/mate/chat', {
      message: dto.message, history: (dto.history ?? []).slice(-12), recipe, stepIndex: dto.stepIndex ?? null,
      persona: dto.persona ?? profile?.matePersona ?? 'masala', lang: dto.lang ?? profile?.preferredLanguage ?? 'en',
      allergies: profile?.allergies ?? dto.allergies ?? [], diets: profile?.diets ?? dto.diets ?? [],
    });
    if (!out || typeof out.reply !== 'string' || !out.reply.trim()) throw Errors.badGateway('AI_INVALID_OUTPUT', 'Mate could not answer — please try again.');
    return { ...out, source: 'ai' as const };
  }
}

@ApiTags('Cooking Mate') @ApiBearerAuth()
@Controller('cooking-mate')
export class CookingMateController {
  constructor(private readonly svc: CookingMateService) {}
  @OptionalAuth() @Throttle(perMinute(30)) @Post('chat') @HttpCode(200)
  @ApiOperation({ summary: 'Ask Cooking Mate about the recipe/step you are on. Never returns invented answers: errors are explicit.' })
  chat(@Body() dto: MateChatDto, @CurrentUser() u?: AuthUser) { return this.svc.chat(dto, u?.id); }
}

@Module({ controllers: [CookingMateController], providers: [CookingMateService] })
export class CookingMateModule {}
