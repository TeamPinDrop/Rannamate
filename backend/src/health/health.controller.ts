import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/auth.decorators';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { pingDatabase } from '../database/mysql/mysql.pool';
import { AiServiceClient } from '../integrations/ai-service/ai.client';

@ApiTags('Health') @Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig, private readonly ai: AiServiceClient) {}

  @Get() @ApiOperation({ summary: 'What is running and what is configured (no secrets)' })
  async health() {
    const db = this.cfg.dataSource === 'memory'
      ? { mode: 'memory', status: 'temporary in-memory store — data is lost on restart' }
      : { mode: 'mysql', database: this.cfg.db.database, status: this.cfg.db.configured ? await pingDatabase(this.cfg) : 'not_configured', schema: { mapped: ['users', 'user_profiles', 'user_preferences', 'user_allergies', 'user_dietary_preferences', 'user_sessions'], pending: 'recipes, ingredients, inventory, favourites, cooking sessions, Tastory' } };
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      dataSource: db,
      aiService: { configured: this.cfg.ai.configured, ...(await this.ai.health()) },
      storage: { provider: this.cfg.storage.provider || 'not_configured' },
      auth: { email: this.cfg.mail.configured ? 'configured' : 'not_configured', google: this.cfg.google.configured ? 'configured' : 'not_configured' },
      time: new Date().toISOString(),
    };
  }
}
