import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** TEST-ONLY fake of the FastAPI AI service. Records requests and returns scripted answers. */
export function startFakeAi(key: string) {
  const calls: { path: string; body: unknown; key?: string }[] = [];
  let next: Record<string, { status: number; body: unknown }> = {};
  const server: Server = createServer(async (req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks);
    let body: unknown = raw.length;
    if ((req.headers['content-type'] ?? '').includes('json')) body = JSON.parse(raw.toString());
    calls.push({ path: req.url!, body, key: req.headers['x-internal-key'] as string });
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ status: 'ok', providers: { active: 'fake' } })); }
    if (req.headers['x-internal-key'] !== key) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ detail: { code: 'INVALID_SERVICE_KEY' } })); }
    const r = next[req.url!] ?? { status: 500, body: {} };
    res.writeHead(r.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(r.body));
  });
  return new Promise<{ url: string; calls: typeof calls; respond: (path: string, status: number, body: unknown) => void; close: () => void }>((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, calls, respond: (p, s, b) => { next = { ...next, [p]: { status: s, body: b } }; }, close: () => server.close() });
    }),
  );
}

export async function bootApp(env: Record<string, string>, override?: (b: TestingModuleBuilder) => TestingModuleBuilder): Promise<INestApplication> {
  const keep = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test', JWT_SECRET: 'test-access-secret-0123456789-0123456789', JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-012345678',
    STORAGE_PROVIDER: 'local', STORAGE_SIGNING_SECRET: 'test-signing-secret-0123456789-0123456789', STORAGE_LOCAL_DIR: mkdtempSync(join(tmpdir(), 'rm-store-')),
    ...env,
  });
  const builder = Test.createTestingModule({ imports: [AppModule] });
  const mod = await (override ? override(builder) : builder).compile();
  const app = mod.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  process.env = keep;
  return app;
}

export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), Buffer.alloc(200, 7)]);
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 3)]);

/** TEST-ONLY: a browser-like client — keeps cookies and sends the CSRF header like the frontend does. */
export async function browserClient(server: Parameters<typeof request.agent>[0]) {
  const agent = request.agent(server);
  const r = await agent.get('/api/v1/auth/csrf').expect(200);
  let csrf = r.body.data.csrfToken as string;
  const post = (path: string, body?: object) => agent.post(`/api/v1${path}`).set('X-CSRF-Token', csrf).send(body ?? {});
  return { agent, get csrf() { return csrf; }, setCsrf: (t: string) => { csrf = t; }, post };
}

/** TEST-ONLY: register through the real cookie + CSRF flow and return the access token. */
export async function registerUser(server: Parameters<typeof request.agent>[0], email: string, password = 'cooking123') {
  const b = await browserClient(server);
  const r = await b.post('/auth/register', { email, password, displayName: 'Chef ' + email.split('@')[0], acceptTerms: true }).expect(201);
  b.setCsrf(r.body.data.csrfToken);
  return { token: r.body.data.accessToken as string, user: r.body.data.user, browser: b, res: r };
}
