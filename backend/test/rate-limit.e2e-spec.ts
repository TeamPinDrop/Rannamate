import type { INestApplication } from '@nestjs/common';

// real limits for this file only (set before the app modules are loaded)
process.env.RATE_LIMIT_MULTIPLIER = '1';

describe('rate limiting', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const { bootApp } = await import('./helpers');
    app = await bootApp({ DATA_SOURCE: 'memory' });
  });
  afterAll(async () => { await app?.close(); });

  it('login is limited to 10 attempts per minute', async () => {
    const { browserClient } = await import('./helpers');
    const b = await browserClient(app.getHttpServer());
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await b.post('/auth/login', { email: 'x@example.com', password: 'whatever1' })).status);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    const last = await b.post('/auth/login', { email: 'x@example.com', password: 'whatever1' });
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('password-reset rate limit', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const { bootApp } = await import('./helpers');
    app = await bootApp({ DATA_SOURCE: 'memory' });
  });
  afterAll(async () => { await app?.close(); });
  it('forgot-password is limited to 5 per minute', async () => {
    const { browserClient } = await import('./helpers');
    const b = await browserClient(app.getHttpServer());
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await b.post('/auth/password/forgot', { email: 'x@example.com' })).status);
    expect(codes.slice(0, 5).every((c) => c === 503)).toBe(true); // email not configured in this suite
    expect(codes[5]).toBe(429);
  });
});
