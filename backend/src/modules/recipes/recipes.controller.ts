import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { RecipeQueryDto } from './recipes.dto';
import { RecipesService } from './recipes.service';

@ApiTags('Recipes') @Public()
@Controller()
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get('recipes') @ApiOperation({ summary: 'List / search / filter recipes (paginated)' })
  list(@Query() q: RecipeQueryDto) { return this.recipes.list(q); }

  @Get('recipes/:id') @ApiOperation({ summary: 'Recipe detail with ingredients, steps, dietary and allergen info' })
  detail(@Param('id') id: string) { return this.recipes.detail(id); }

  @Get('recipes/:id/ingredients') @ApiOperation({ summary: 'Ingredients of a recipe' })
  async ingredients(@Param('id') id: string) { return this.recipes.ingredientsOf(await this.recipes.get(id)); }

  @Get('recipes/:id/steps') @ApiOperation({ summary: 'Cooking steps of a recipe' })
  async steps(@Param('id') id: string) { return this.recipes.steps(await this.recipes.get(id)); }

  @Get('discovery') @ApiOperation({ summary: 'Discover-page facets: cuisines, moods, diets, difficulty, categories with counts' })
  discovery() { return this.recipes.discovery(); }
}
