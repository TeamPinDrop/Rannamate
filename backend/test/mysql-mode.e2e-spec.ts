import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp } from './helpers';

/** Default mode: MySQL selected but not configured. Nothing may silently fall back to fake data. */
describe('DATA_SOURCE=mysql without a connection', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await bootApp({ DATA_SOURCE: 'mysql', DB_HOST: '', DB_USERNAME: '', AI_SERVICE_URL: '', AI_SERVICE_API_KEY: '' }); });
  afterAll(async () => { await app?.close(); });

  it('health says the database is not configured', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(r.body.data.dataSource).toMatchObject({ mode: 'mysql', status: 'not_configured', schema: 'not_verified' });
    expect(r.body.data.aiService.configured).toBe(false);
  });

  it.each(['/api/v1/recipes', '/api/v1/ingredients', '/api/v1/discovery'])('%s → 503 DATABASE_NOT_CONFIGURED (no fake data)', async (p) => {
    const r = await request(app.getHttpServer()).get(p).expect(503);
    expect(r.body.error.code).toBe('DATABASE_NOT_CONFIGURED');
  });

  it('registration also refuses instead of pretending to save', async () => {
    const { browserClient } = await import('./helpers');
    const b = await browserClient(app.getHttpServer());
    const r = await b.post('/auth/register', { email: 'a@b.com', password: 'abcdefg1', displayName: 'Al', acceptTerms: true }).expect(503);
    expect(r.body.error.code).toBe('DATABASE_NOT_CONFIGURED');
  });

  it('AI features say the AI service is not configured', async () => {
    // recipes are needed first, so the DB error comes first for recipe-bound requests;
    // a recipe-less Mate question reaches the AI check
    const r = await request(app.getHttpServer()).post('/api/v1/cooking-mate/chat').send({ message: 'hi' }).expect(503);
    expect(r.body.error.code).toBe('AI_SERVICE_NOT_CONFIGURED');
  });
});

describe('DATA_SOURCE=mysql with credentials but unmapped schema', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await bootApp({ DATA_SOURCE: 'mysql', DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USERNAME: 'placeholder' }); });
  afterAll(async () => { await app?.close(); });
  it('returns SCHEMA_NOT_VERIFIED rather than guessing columns', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/recipes').expect(503);
    expect(r.body.error.code).toBe('SCHEMA_NOT_VERIFIED');
  });
});
