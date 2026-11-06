import { Body, Controller, HttpCode, Inject, Injectable, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { perMinute } from '../../common/utils/rate-limit';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CurrentUser, OptionalAuth, type AuthUser } from '../../common/decorators/auth.decorators';
import { Errors } from '../../common/errors';
import { REPO, type IngredientsRepository, type RecipesRepository, type UsersRepository } from '../../database/repositories';
import { LANGS, PERSONAS } from '../../domain/types';
import { AiServiceClient } from '../../integrations/ai-service/ai.client';
import { classifyStep, MIN_SECONDS, WRAP_UP_SECONDS } from './safety';

const KINDS = ['trivia', 'guess', 'wyr', 'wyr-react', 'jokes', 'riddles', 'chat', 'story', 'song'] as const;

class ChatLine { @IsIn(['user', 'mate']) who: 'user' | 'mate'; @IsString() @MaxLength(600) text: string }
class StoryBeat { @IsString() @MaxLength(1000) text: string; @IsOptional() @IsString() @MaxLength(120) choice?: string }

export class ChillActivityDto {
  @ApiProperty({ enum: KINDS, description: 'Food Facts are served from the curated library in the app, never generated.' }) @IsIn(KINDS) activity: (typeof KINDS)[number];
  @ApiProperty({ example: 'dal-tadka' }) @IsString() @MaxLength(80) recipeId: string;
  @ApiProperty({ description: '0-based step the user is on' }) @Type(() => Number) @IsInt() @Min(0) stepIndex: number;
  @ApiProperty({ description: 'Seconds left on the frontend timer (read-only; the server never controls it)' }) @Type(() => Number) @IsInt() @Min(0) @Max(7200) remainingSec: number;
  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] }) @IsOptional() @IsIn(['easy', 'medium', 'hard']) difficulty?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(120, { each: true }) recent?: string[];
  @ApiPropertyOptional({ type: [ChatLine] }) @IsOptional() @IsArray() @ArrayMaxSize(24) @ValidateNested({ each: true }) @Type(() => ChatLine) messages?: ChatLine[];
  @ApiPropertyOptional() @IsOptional() @IsObject() question?: { a: string; b: string };
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(90) picked?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) prompt?: string;
  @ApiPropertyOptional({ type: [StoryBeat] }) @IsOptional() @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => StoryBeat) beats?: StoryBeat[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(2) @Max(4) maxBeats?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) topic?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) style?: string;
  @ApiPropertyOptional({ enum: PERSONAS }) @IsOptional() @IsIn(PERSONAS) persona?: string;
  @ApiPropertyOptional({ enum: LANGS }) @IsOptional() @IsIn(LANGS) lang?: string;
}

/**
 * Cook & Chill content — only during a safe waiting step, never in the wrap-up window.
 * Safety and timing are checked here before the AI is ever called.
 */
@Injectable()
export class CookAndChillService {
  constructor(
    private readonly ai: AiServiceClient,
    @Inject(REPO.recipes) private readonly recipes: RecipesRepository,
    @Inject(REPO.ingredients) private readonly ingredients: IngredientsRepository,
    @Inject(REPO.users) private readonly users: UsersRepository,
  ) {}

  async activity(dto: ChillActivityDto, userId?: string) {
    const r = await this.recipes.findById(dto.recipeId);
    if (!r) throw Errors.notFound('Recipe');
    const step = r.steps[dto.stepIndex];
    if (!step) throw Errors.badRequest('STEP_OUT_OF_RANGE', `This recipe has ${r.steps.length} steps.`);
    const safety = classifyStep(step.text, step.timer);
    if (safety.level !== 'passive') throw Errors.conflict('COOKING_ATTENTION_REQUIRED', `This step needs your full attention (${safety.reason}). Cook & Chill is paused.`, { reason: safety.reason, level: safety.level });
    if (dto.activity !== 'wyr-react' && dto.remainingSec < WRAP_UP_SECONDS) throw Errors.conflict('WRAP_UP', "Your timer is almost done — time to check the food. No new activities now.");
    if (dto.remainingSec < (MIN_SECONDS[dto.activity] ?? 0)) throw Errors.conflict('NOT_ENOUGH_TIME', `Not enough time left for this activity (needs about ${Math.ceil(MIN_SECONDS[dto.activity] / 60)} min).`);
    if (dto.activity === 'chat' && !dto.messages?.length) throw Errors.badRequest('MESSAGES_REQUIRED', 'Send the conversation so far.');
    if (dto.activity === 'wyr-react' && (!dto.question || !dto.picked)) throw Errors.badRequest('CHOICE_REQUIRED', 'Send the question and the picked option.');

    const profile = userId ? await this.users.getProfile(userId) : null;
    const ing = await this.ingredients.findByIds(r.ingredients.map((i) => i.ingredientId));
    const ctx = {
      recipeName: r.name, cuisine: r.cuisine, stepText: step.text, nextStepText: r.steps[dto.stepIndex + 1]?.text ?? null, remainingSec: dto.remainingSec,
      ingredients: ing.filter((i) => !i.staple).map((i) => i.name), pantry: [],
      persona: dto.persona ?? profile?.matePersona ?? 'masala', lang: dto.lang ?? profile?.preferredLanguage ?? 'en', allergies: profile?.allergies ?? [],
    };
    const { activity, recipeId: _r, stepIndex: _s, remainingSec: _t, persona: _p, lang: _l, ...rest } = dto;
    const out = await this.ai.postJson<{ data: unknown; model?: string }>('/v1/chill/activity', { activity, ctx, ...rest });
    return { activity, source: 'ai' as const, data: out.data, safety: { level: safety.level, note: safety.note ?? null } };
  }
}

@ApiTags('Cook & Chill') @ApiBearerAuth()
@Controller('cook-and-chill')
export class CookAndChillController {
  constructor(private readonly svc: CookAndChillService) {}
  @OptionalAuth() @Throttle(perMinute(30)) @Post('activity') @HttpCode(200)
  @ApiOperation({ summary: 'Generate one Cook & Chill item. 409 when the step is unsafe, the timer is nearly done, or there is not enough time.' })
  activity(@Body() dto: ChillActivityDto, @CurrentUser() u?: AuthUser) { return this.svc.activity(dto, u?.id); }
}

@Module({ controllers: [CookAndChillController], providers: [CookAndChillService] })
export class CookAndChillModule {}
