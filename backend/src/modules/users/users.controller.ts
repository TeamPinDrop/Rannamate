import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/auth.decorators';
import { UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Users') @ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me') @ApiOperation({ summary: 'Your account and profile' }) me(@CurrentUser() u: AuthUser) { return this.users.me(u.id); }
  @Patch('me') @ApiOperation({ summary: 'Update your profile (name, allergies, diets, Mate language & persona)' })
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) { return this.users.update(u.id, dto); }
}
