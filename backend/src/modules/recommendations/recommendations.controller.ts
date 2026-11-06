import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth, type AuthUser } from '../../common/decorators/auth.decorators';
import { RecommendDto } from './recommendations.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Recommendations') @ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly reco: RecommendationsService) {}

  @OptionalAuth() @Post() @HttpCode(200)
  @ApiOperation({ summary: 'Ranked recipe recommendations with reasons. Allergies/diets/equipment are hard exclusions. Signing in adds your profile, kitchen, favourites and history.' })
  recommend(@Body() dto: RecommendDto, @CurrentUser() user?: AuthUser) { return this.reco.recommend(dto, user?.id); }
}
