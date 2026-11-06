import { Inject, Injectable } from '@nestjs/common';
import { defined } from '../../common/utils/defined';
import { randomUUID } from 'node:crypto';
import { Errors } from '../../common/errors';
import { Paginated } from '../../common/utils/pagination';
import { REPO, type MemoriesRepository, type RecipesRepository } from '../../database/repositories';
import type { Memory, MemoryPhoto } from '../../domain/types';
import { validateImage, type UploadedImage } from '../../integrations/storage/image-validation';
import { StorageService } from '../../integrations/storage/storage.service';
import type { CreateMemoryDto, MemoryQueryDto, UpdateMemoryDto } from './memories.dto';

export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const RECENT_DAYS = 30;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Tastory — personal food memories. Mirrors the frontend journal (lib/tastory):
 * dish (required), ≥1 photo (required), date, caption, notes, rating 1–5, tags, favourite, optional recipe link.
 * Photos live in private storage; responses carry short-lived signed URLs only.
 */
@Injectable()
export class MemoriesService {
  constructor(
    @Inject(REPO.memories) private readonly repo: MemoriesRepository,
    @Inject(REPO.recipes) private readonly recipes: RecipesRepository,
    private readonly storage: StorageService,
  ) {}

  view(m: Memory) {
    const { userId: _u, photos, ...rest } = m;
    return {
      ...rest,
      coverPhotoId: photos[0]?.id ?? null,
      photos: photos.map((p) => ({ id: p.id, alt: p.alt, contentType: p.contentType, bytes: p.bytes, createdAt: p.createdAt, ...this.storage.signedUrl(p.storageKey) })),
    };
  }

  private async own(userId: string, id: string) {
    const m = await this.repo.findById(userId, id);
    if (!m) throw Errors.notFound('Memory');
    return m;
  }

  private checkDate(d?: string) { if (d && d > today()) throw Errors.badRequest('DATE_IN_FUTURE', "The cooking date can't be in the future."); }
  private async checkRecipe(id?: string | null) { if (id && !(await this.recipes.findById(id))) throw Errors.badRequest('UNKNOWN_RECIPE', 'The linked recipe does not exist.'); }

  /** Validates every file BEFORE anything is stored, then stores them; rolls back on failure. */
  private async storePhotos(userId: string, files: UploadedImage[], dish: string, startIndex: number): Promise<MemoryPhoto[]> {
    const types = files.map((f) => validateImage(f, { maxBytes: MAX_PHOTO_BYTES, allowed: OK, label: 'image' }));
    const out: MemoryPhoto[] = [];
    try {
      for (const [i, f] of files.entries()) {
        const key = this.storage.newKey(userId, types[i]);
        await this.storage.put(key, f.buffer);
        out.push({ id: randomUUID(), storageKey: key, contentType: types[i], bytes: f.size, alt: `${dish} — photo ${startIndex + i + 1}`, createdAt: new Date().toISOString() });
      }
      return out;
    } catch (e) {
      await this.storage.delete(out.map((p) => p.storageKey)).catch(() => undefined);
      throw e;
    }
  }

  async create(userId: string, dto: CreateMemoryDto, files: UploadedImage[]) {
    if (!files.length) throw Errors.badRequest('PHOTO_REQUIRED', 'Add at least one photograph.');
    if (files.length > MAX_PHOTOS) throw Errors.badRequest('TOO_MANY_PHOTOS', `A memory can have up to ${MAX_PHOTOS} photos.`);
    this.checkDate(dto.date);
    await this.checkRecipe(dto.recipeId);
    const photos = await this.storePhotos(userId, files, dto.dish, 0);
    try {
      const m = await this.repo.create({
        userId, dish: dto.dish, date: dto.date ?? today(), caption: dto.caption ?? '', notes: dto.notes ?? '', rating: dto.rating ?? null,
        tags: dto.tags ?? [], favourite: dto.favourite ?? false, recipeId: dto.recipeId ?? null, photos,
      });
      return this.view(m);
    } catch (e) {
      await this.storage.delete(photos.map((p) => p.storageKey)).catch(() => undefined);
      throw e;
    }
  }

  private filtered(all: Memory[], q: Pick<MemoryQueryDto, 'q' | 'filter' | 'sort'>) {
    const terms = (q.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const now = Date.now();
    let out = all.filter((m) => { const hay = [m.dish, m.caption, m.notes, ...m.tags].join(' ').toLowerCase(); return terms.every((t) => hay.includes(t)); });
    if (q.filter === 'favourites') out = out.filter((m) => m.favourite);
    if (q.filter === 'recent') out = out.filter((m) => now - Date.parse(m.createdAt) <= RECENT_DAYS * 86_400_000);
    if (q.filter === 'top') out = out.filter((m) => (m.rating ?? 0) >= 4);
    const byDate = (a: Memory, b: Memory) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
    return out.sort(q.sort === 'oldest' ? byDate : q.sort === 'rating' ? (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byDate(b, a) : q.sort === 'az' ? (a, b) => a.dish.localeCompare(b.dish, undefined, { sensitivity: 'base' }) : (a, b) => byDate(b, a));
  }

  async list(userId: string, q: MemoryQueryDto) {
    const all = this.filtered(await this.repo.list(userId), q);
    const page = Paginated.of(all, q.page, q.pageSize);
    return new Paginated(page.items.map((m) => this.view(m)), all.length, q.page, q.pageSize);
  }

  async timeline(userId: string, q: MemoryQueryDto) {
    const all = this.filtered(await this.repo.list(userId), { ...q, sort: q.sort === 'oldest' ? 'oldest' : 'newest' });
    const groups: { month: string; label: string; count: number; items: ReturnType<MemoriesService['view']>[] }[] = [];
    for (const m of all) {
      const month = m.date.slice(0, 7);
      let g = groups[groups.length - 1];
      if (!g || g.month !== month) {
        g = { month, label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }), count: 0, items: [] };
        groups.push(g);
      }
      g.items.push(this.view(m));
      g.count++;
    }
    return { total: all.length, groups };
  }

  async statistics(userId: string) {
    const all = await this.repo.list(userId);
    return {
      memories: all.length,
      photos: all.reduce((n, m) => n + m.photos.length, 0),
      favourites: all.filter((m) => m.favourite).length,
      latestDate: all.reduce<string | null>((d, m) => (!d || m.date > d ? m.date : d), null),
      averageRating: (() => { const r = all.filter((m) => m.rating); return r.length ? Math.round((r.reduce((a, m) => a + m.rating!, 0) / r.length) * 10) / 10 : null; })(),
    };
  }

  async get(userId: string, id: string) { return this.view(await this.own(userId, id)); }

  async update(userId: string, id: string, dto: UpdateMemoryDto) {
    await this.own(userId, id);
    this.checkDate(dto.date);
    await this.checkRecipe(dto.recipeId);
    return this.view((await this.repo.update(userId, id, defined(dto)))!);
  }

  async remove(userId: string, id: string) {
    const m = await this.own(userId, id);
    await this.repo.delete(userId, id);
    await this.storage.delete(m.photos.map((p) => p.storageKey)).catch(() => undefined);
  }

  async setFavourite(userId: string, id: string, favourite?: boolean) {
    const m = await this.own(userId, id);
    return this.view((await this.repo.update(userId, id, { favourite: favourite ?? !m.favourite }))!);
  }

  async addPhotos(userId: string, id: string, files: UploadedImage[]) {
    const m = await this.own(userId, id);
    if (!files.length) throw Errors.badRequest('PHOTO_REQUIRED', 'Attach at least one photograph.');
    if (m.photos.length + files.length > MAX_PHOTOS) throw Errors.badRequest('TOO_MANY_PHOTOS', `A memory can have up to ${MAX_PHOTOS} photos (it has ${m.photos.length}).`);
    const added = await this.storePhotos(userId, files, m.dish, m.photos.length);
    return this.view((await this.repo.update(userId, id, { photos: [...m.photos, ...added] }))!);
  }

  async removePhoto(userId: string, id: string, photoId: string) {
    const m = await this.own(userId, id);
    const p = m.photos.find((x) => x.id === photoId);
    if (!p) throw Errors.notFound('Photo');
    if (m.photos.length === 1) throw Errors.conflict('LAST_PHOTO', 'A memory needs at least one photograph — add another before removing this one.');
    const u = await this.repo.update(userId, id, { photos: m.photos.filter((x) => x.id !== photoId) });
    await this.storage.delete([p.storageKey]).catch(() => undefined);
    return this.view(u!);
  }

  async setCover(userId: string, id: string, photoId: string) {
    const m = await this.own(userId, id);
    const p = m.photos.find((x) => x.id === photoId);
    if (!p) throw Errors.notFound('Photo');
    return this.view((await this.repo.update(userId, id, { photos: [p, ...m.photos.filter((x) => x.id !== photoId)] }))!);
  }

  async reorder(userId: string, id: string, ids: string[]) {
    const m = await this.own(userId, id);
    if (ids.length !== m.photos.length || !ids.every((x) => m.photos.some((p) => p.id === x))) throw Errors.badRequest('INVALID_ORDER', 'photoIds must list every photo of this memory exactly once.');
    return this.view((await this.repo.update(userId, id, { photos: ids.map((x) => m.photos.find((p) => p.id === x)!) }))!);
  }
}
