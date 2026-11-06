import { Body, Controller, Get, Inject, Injectable, Module, Param, ParseIntPipe, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';
import { ParseIdPipe } from '../../common/utils/id.pipe';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../../common/decorators/auth.decorators';
import { Errors } from '../../common/errors';
import { REPO, type CookingSessionsRepository, type RecipesRepository } from '../../database/repositories';
import type { CookingSession } from '../../domain/types';

class StartSessionDto { @ApiProperty({ example: 'dal-tadka' }) @IsString() @MaxLength(80) recipeId: string }
class UpdateSessionDto { @ApiProperty({ description: '0-based step index' }) @Type(() => Number) @IsInt() @Min(0) currentStep: number }

/**
 * Persists cooking progress. Timers are NOT run here — the frontend's timestamp-based timer stays
 * the single source of truth; the server only records when steps and sessions were completed.
 */
@Injectable()
export class CookingSessionsService {
  constructor(@Inject(REPO.cookingSessions) private readonly repo: CookingSessionsRepository, @Inject(REPO.recipes) private readonly recipes: RecipesRepository) {}

  private view(s: CookingSession, totalSteps: number) {
    const { userId: _u, ...rest } = s;
    const done = s.steps.filter((x) => x.completedAt).length;
    return { ...rest, totalSteps, completedSteps: done, progress: totalSteps ? Math.round((done / totalSteps) * 100) / 100 : 0 };
  }
  private async withTotal(s: CookingSession) { return this.view(s, (await this.recipes.findById(s.recipeId))?.steps.length ?? s.steps.length); }
  private async active(userId: string, id: string) {
    const s = await this.repo.findById(userId, id);
    if (!s) throw Errors.notFound('Cooking session');
    if (s.status !== 'active') throw Errors.conflict('SESSION_NOT_ACTIVE', `This cooking session is already ${s.status}.`);
    return s;
  }

  /** Resumes the active session for the same recipe; a different recipe marks the old one abandoned. */
  async start(userId: string, recipeId: string) {
    const recipe = await this.recipes.findById(recipeId);
    if (!recipe) throw Errors.notFound('Recipe');
    const current = await this.repo.findActive(userId);
    if (current?.recipeId === recipeId) return { created: false, session: this.view(current, recipe.steps.length) };
    if (current) await this.repo.update(userId, current.id, { status: 'abandoned', endedAt: new Date().toISOString() });
    const s = await this.repo.create({ userId, recipeId, status: 'active', currentStep: 0, steps: recipe.steps.map((_, index) => ({ index, completedAt: null })), endedAt: null });
    return { created: true, session: this.view(s, recipe.steps.length) };
  }

  async getActive(userId: string) { const s = await this.repo.findActive(userId); return s ? this.withTotal(s) : null; }
  async get(userId: string, id: string) { const s = await this.repo.findById(userId, id); if (!s) throw Errors.notFound('Cooking session'); return this.withTotal(s); }

  async moveTo(userId: string, id: string, step: number) {
    const s = await this.active(userId, id);
    if (step >= s.steps.length) throw Errors.badRequest('STEP_OUT_OF_RANGE', `This recipe has ${s.steps.length} steps (0–${s.steps.length - 1}).`);
    return this.withTotal((await this.repo.update(userId, id, { currentStep: step }))!);
  }

  async completeStep(userId: string, id: string, step: number) {
    const s = await this.active(userId, id);
    if (step < 0 || step >= s.steps.length) throw Errors.badRequest('STEP_OUT_OF_RANGE', `This recipe has ${s.steps.length} steps (0–${s.steps.length - 1}).`);
    const steps = s.steps.map((x) => (x.index === step && !x.completedAt ? { ...x, completedAt: new Date().toISOString() } : x));
    return this.withTotal((await this.repo.update(userId, id, { steps, currentStep: Math.min(Math.max(s.currentStep, step + 1), s.steps.length - 1) }))!);
  }

  async finish(userId: string, id: string, status: 'completed' | 'cancelled') {
    await this.active(userId, id);
    return this.withTotal((await this.repo.update(userId, id, { status, endedAt: new Date().toISOString() }))!);
  }
}

@ApiTags('Cooking sessions') @ApiBearerAuth()
@Controller('cooking-sessions')
export class CookingSessionsController {
  constructor(private readonly svc: CookingSessionsService) {}
  @Post() @ApiOperation({ summary: 'Start (or resume) cooking a recipe' })
  async start(@CurrentUser() u: AuthUser, @Body() dto: StartSessionDto, @Res({ passthrough: true }) res: Response) { const r = await this.svc.start(u.id, dto.recipeId); res.status(r.created ? 201 : 200); return r.session; }
  @Get('active') @ApiOperation({ summary: 'Your active cooking session, or null' }) active(@CurrentUser() u: AuthUser) { return this.svc.getActive(u.id); }
  @Get(':id') @ApiOperation({ summary: 'One cooking session' }) get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.get(u.id, id); }
  @Patch(':id') @ApiOperation({ summary: 'Move to a step' }) move(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateSessionDto) { return this.svc.moveTo(u.id, id, dto.currentStep); }
  @Post(':id/steps/:step/complete') @ApiOperation({ summary: 'Mark a step (0-based) as done' })
  completeStep(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('step', ParseIntPipe) step: number) { return this.svc.completeStep(u.id, id, step); }
  @Post(':id/complete') @ApiOperation({ summary: 'Finish the session' }) complete(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.finish(u.id, id, 'completed'); }
  @Post(':id/cancel') @ApiOperation({ summary: 'Cancel the session' }) cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.finish(u.id, id, 'cancelled'); }
}

@Module({ controllers: [CookingSessionsController], providers: [CookingSessionsService] })
export class CookingSessionsModule {}
