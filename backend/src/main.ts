import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigError, loadConfig } from './config/configuration';
import { closePool } from './database/mysql/mysql.pool';
import { configureApp } from './setup';
import { loadDotEnv } from './config/dotenv';

async function bootstrap() {
  loadDotEnv();
  try { loadConfig(); } catch (e) {
    if (e instanceof ConfigError) { console.error(`\n${e.message}\n`); process.exit(1); }
    throw e;
  }
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const cfg = configureApp(app);
  app.getHttpAdapter().getInstance().on?.('close', () => void closePool());
  await app.listen(cfg.port);
  const log = new Logger('RANNAMATE');
  log.log(`API      http://localhost:${cfg.port}/api/v1`);
  log.log(`Docs     http://localhost:${cfg.port}/api/docs`);
  log.log(`Data     ${cfg.dataSource}${cfg.dataSource === 'mysql' ? (cfg.db.configured ? ' (configured — schema not yet mapped)' : ' (NOT configured — database endpoints return 503)') : ' (temporary, in-memory)'}`);
  log.log(`AI       ${cfg.ai.configured ? cfg.ai.url : 'not configured'}`);
  log.log(`Storage  ${cfg.storage.provider || 'not configured'}`);
  log.log(`Email    ${cfg.mail.configured ? `SMTP ${cfg.mail.host}` : 'not configured (password-reset emails are refused with 503, never faked)'}`);
  log.log(`Google   ${cfg.google.configured ? 'configured' : 'not configured (button hidden in the app)'}`);
  if (cfg.dataSource === 'memory') log.warn('Accounts are in memory: every sign-up is lost when the backend restarts.');
}
void bootstrap();
