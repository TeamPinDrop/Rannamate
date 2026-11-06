import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../../common/decorators/auth.decorators';
import { Errors } from '../../common/errors';
import { REPO, type FavouritesRepository, type RecipesRepository } from '../../database/repositories';
import { summary } from '../recipes/recipes.service';

class AddFavouriteDto { @ApiProperty({ example: 'dal-tadka' }) @IsString() @MaxLength(80) recipeId: string }

@Injectable()
export class FavouritesService {
  constructor(@Inject(REPO.favourites) private readonly repo: FavouritesRepository, @Inject(REPO.recipes) private readonly recipes: RecipesRepository) {}
  async list(userId: string) {
    const favs = await this.repo.list(userId);
    const recipes = new Map((await this.recipes.findByIds(favs.map((f) => f.recipeId))).map((r) => [r.id, r]));
    return favs.filter((f) => recipes.has(f.recipeId)).map((f) => ({ recipe: summary(recipes.get(f.recipeId)!), addedAt: f.createdAt }));
  }
  async add(userId: string, recipeId: string) {
    if (!(await this.recipes.findById(recipeId))) throw Errors.notFound('Recipe');
    return this.repo.add(userId, recipeId);
  }
  async remove(userId: string, recipeId: string) { if (!(await this.repo.remove(userId, recipeId))) throw Errors.notFound('Favourite'); }
  async status(userId: string, recipeId: string) { return { recipeId, favourite: await this.repo.has(userId, recipeId) }; }
}

@ApiTags('Favourites') @ApiBearerAuth()
@Controller('favourites')
export class FavouritesController {
  constructor(private readonly svc: FavouritesService) {}
  @Get() @ApiOperation({ summary: 'Your favourite recipes' }) list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post() @ApiOperation({ summary: 'Add a favourite (201 new, 200 already there)' })
  async add(@CurrentUser() u: AuthUser, @Body() dto: AddFavouriteDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.svc.add(u.id, dto.recipeId);
    res.status(r.created ? 201 : 200);
    return { recipeId: dto.recipeId, favourite: true };
  }
  @Get(':recipeId') @ApiOperation({ summary: 'Is this recipe a favourite?' }) status(@CurrentUser() u: AuthUser, @Param('recipeId') id: string) { return this.svc.status(u.id, id); }
  @Delete(':recipeId') @HttpCode(204) @ApiOperation({ summary: 'Remove a favourite' }) remove(@CurrentUser() u: AuthUser, @Param('recipeId') id: string) { return this.svc.remove(u.id, id); }
}

@Module({ controllers: [FavouritesController], providers: [FavouritesService] })
export class FavouritesModule {}
