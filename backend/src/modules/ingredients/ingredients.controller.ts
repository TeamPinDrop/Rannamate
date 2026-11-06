import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../../common/decorators/auth.decorators';
import { Errors } from '../../common/errors';
import { PageQuery, Paginated } from '../../common/utils/pagination';
import { REPO, type IngredientsRepository } from '../../database/repositories';
import { CATEGORIES } from '../../domain/types';

class IngredientQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Name or alias (e.g. "aloo")' }) @IsOptional() @IsString() @MaxLength(60) q?: string;
  @ApiPropertyOptional({ enum: CATEGORIES }) @IsOptional() @IsIn(CATEGORIES) category?: string;
}

@ApiTags('Ingredients') @Public()
@Controller('ingredients')
export class IngredientsController {
  constructor(@Inject(REPO.ingredients) private readonly repo: IngredientsRepository) {}

  @Get() @ApiOperation({ summary: 'Ingredient catalogue — search by name/alias, filter by category' })
  async list(@Query() q: IngredientQuery) { const { items, total } = await this.repo.search(q); return new Paginated(items, total, q.page, q.pageSize); }

  @Get('categories') @ApiOperation({ summary: 'Ingredient categories' })
  categories() { return this.repo.categories(); }

  @Get(':id') @ApiOperation({ summary: 'One ingredient' })
  async one(@Param('id') id: string) { const i = await this.repo.findById(id); if (!i) throw Errors.notFound('Ingredient'); return i; }
}
