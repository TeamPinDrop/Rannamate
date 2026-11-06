import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AppError, Errors } from '../../common/errors';

/**
 * Client for the internal FastAPI AI service (ai-service/). Only this class talks to it.
 * The service is authenticated with a shared key (X-Internal-Key) and is never exposed to the browser.
 * Failures become explicit errors — nothing here fabricates an AI answer.
 */
@Injectable()
export class AiServiceClient {
  private readonly log = new Logger('AiService');
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  get configured() { return this.cfg.ai.configured; }

  async health(): Promise<{ reachable: boolean; providers?: unknown }> {
    if (!this.cfg.ai.configured) return { reachable: false };
    try {
      const r = await fetch(`${this.cfg.ai.url}/health`, { signal: AbortSignal.timeout(3000) });
      return { reachable: r.ok, providers: r.ok ? (await r.json()).providers : undefined };
    } catch { return { reachable: false }; }
  }

  postJson<T>(path: string, body: unknown): Promise<T> {
    return this.call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  postImage<T>(path: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<T> {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname || 'image');
    return this.call<T>(path, { method: 'POST', body: form });
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.cfg.ai.configured) throw Errors.unavailable('AI_SERVICE_NOT_CONFIGURED', 'The AI service is not configured (set AI_SERVICE_URL and AI_SERVICE_API_KEY).');
    let res: Response;
    try {
      res = await fetch(`${this.cfg.ai.url}${path}`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), 'X-Internal-Key': this.cfg.ai.apiKey },
        signal: AbortSignal.timeout(this.cfg.ai.timeoutMs),
      });
    } catch (e) {
      const timeout = e instanceof Error && e.name === 'TimeoutError';
      this.log.warn(`${path}: ${timeout ? 'timed out' : 'unreachable'}`);
      throw Errors.unavailable(timeout ? 'AI_SERVICE_TIMEOUT' : 'AI_SERVICE_UNREACHABLE', timeout ? 'The AI service took too long to answer.' : 'The AI service is not reachable right now.');
    }
    const data = (await res.json().catch(() => ({}))) as { detail?: { code?: string; message?: string } | string };
    if (res.ok) return data as T;
    const d = typeof data.detail === 'object' ? data.detail : { message: data.detail };
    this.log.warn(`${path}: HTTP ${res.status} ${d?.code ?? ''}`);
    if (res.status === 503) throw Errors.unavailable(d?.code ?? 'AI_PROVIDER_NOT_CONFIGURED', d?.message ?? 'The AI provider is not configured.');
    if (res.status === 422) throw Errors.badGateway('AI_INVALID_OUTPUT', 'The AI answer did not pass validation — please try again.');
    if (res.status === 401 || res.status === 403) throw Errors.badGateway('AI_SERVICE_AUTH_FAILED', 'The backend could not authenticate with the AI service.');
    if (res.status === 400 || res.status === 413 || res.status === 415) throw new AppError(res.status as HttpStatus, d?.code ?? 'AI_REJECTED_INPUT', d?.message ?? 'The AI service rejected the input.');
    throw Errors.badGateway('AI_SERVICE_ERROR', 'The AI service failed to answer.');
  }
}
