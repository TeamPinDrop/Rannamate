import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Param, Patch, Post, Res } from '@nestjs/common';
import { defined } from '../../common/utils/defined';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ParseIdPipe } from '../../common/utils/id.pipe';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../../common/decorators/auth.decorators';
import { Errors } from '../../common/errors';
import { REPO, type IngredientsRepository, type InventoryRepository } from '../../database/repositories';
import { UNITS, type InventoryItem, type Unit } from '../../domain/types';

export class AddInventoryDto {
  @ApiProperty({ example: 'tomato' }) @IsString() @MaxLength(60) ingredientId: string;
  @ApiProperty({ example: 2 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(100000) quantity: number;
  @ApiPropertyOptional({ enum: UNITS, description: "Defaults to the ingredient's usual unit" }) @IsOptional() @IsIn(UNITS) unit?: Unit;
  @ApiPropertyOptional({ example: '2026-11-10', nullable: true }) @IsOptional() @ValidateIf((_o, v) => v !== null) @IsDateString({ strict: true }) expiresOn?: string | null;
}
export class UpdateInventoryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(100000) quantity?: number;
  @ApiPropertyOptional({ enum: UNITS }) @IsOptional() @IsIn(UNITS) unit?: Unit;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_o, v) => v !== null) @IsDateString({ strict: true }) expiresOn?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(@Inject(REPO.inventory) private readonly repo: InventoryRepository, @Inject(REPO.ingredients) private readonly ingredients: IngredientsRepository) {}

  private async view(items: InventoryItem[]) {
    const ing = new Map((await this.ingredients.findByIds(items.map((i) => i.ingredientId))).map((i) => [i.id, i]));
    const today = new Date().toISOString().slice(0, 10);
    return items.map(({ userId: _u, ...i }) => ({
      ...i, name: ing.get(i.ingredientId)?.name ?? i.ingredientId, emoji: ing.get(i.ingredientId)?.emoji ?? '🥄', category: ing.get(i.ingredientId)?.category ?? 'Other',
      expired: !!i.expiresOn && i.expiresOn.slice(0, 10) < today,
    }));
  }

  async list(userId: string) { return this.view(await this.repo.list(userId)); }

  /** Adding an ingredient you already have updates it instead of duplicating (matches the frontend's behaviour). */
  async add(userId: string, dto: AddInventoryDto) {
    const ing = await this.ingredients.findById(dto.ingredientId);
    if (!ing) throw Errors.badRequest('UNKNOWN_INGREDIENT', `"${dto.ingredientId}" is not in the ingredient catalogue.`);
    const existing = await this.repo.findByIngredient(userId, dto.ingredientId);
    const unit = dto.unit ?? ing.defaultUnit;
    if (existing) {
      const u = await this.repo.update(userId, existing.id, { quantity: dto.quantity, unit, ...(dto.expiresOn !== undefined ? { expiresOn: dto.expiresOn } : {}) });
      return { created: false, item: (await this.view([u!]))[0] };
    }
    const c = await this.repo.create({ userId, ingredientId: dto.ingredientId, quantity: dto.quantity, unit, expiresOn: dto.expiresOn ?? null });
    return { created: true, item: (await this.view([c]))[0] };
  }

  async update(userId: string, id: string, dto: UpdateInventoryDto) {
    const u = await this.repo.update(userId, id, defined(dto));
    if (!u) throw Errors.notFound('Inventory item');
    return (await this.view([u]))[0];
  }

  async remove(userId: string, id: string) { if (!(await this.repo.delete(userId, id))) throw Errors.notFound('Inventory item'); }
}

@ApiTags('Inventory') @ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}
  @Get() @ApiOperation({ summary: 'Your kitchen inventory' }) list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post() @ApiOperation({ summary: 'Add an ingredient (updates it if already present → 200)' })
  async add(@CurrentUser() u: AuthUser, @Body() dto: AddInventoryDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.svc.add(u.id, dto);
    res.status(r.created ? 201 : 200);
    return r.item;
  }
  @Patch(':id') @ApiOperation({ summary: 'Update quantity, unit or expiry' })
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateInventoryDto) { return this.svc.update(u.id, id, dto); }
  @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Remove an ingredient' })
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.remove(u.id, id); }
}

@Module({ controllers: [InventoryController], providers: [InventoryService] })
export class InventoryModule {}
