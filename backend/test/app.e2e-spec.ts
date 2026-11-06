import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, JPEG, PNG, registerUser, startFakeAi } from './helpers';

const AI_KEY = 'fake-ai-key-for-tests';
let app: INestApplication;
let ai: Awaited<ReturnType<typeof startFakeAi>>;
const http = () => request(app.getHttpServer());
const api = (p: string) => `/api/v1${p}`;

const signup = (email: string) => registerUser(app.getHttpServer(), email);
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  ai = await startFakeAi(AI_KEY);
  app = await bootApp({ DATA_SOURCE: 'memory', AI_SERVICE_URL: ai.url, AI_SERVICE_API_KEY: AI_KEY });
});
afterAll(async () => { await app.close(); ai.close(); });

describe('health & docs', () => {
  it('reports what is running without secrets', async () => {
    const r = await http().get(api('/health')).expect(200);
    expect(r.body.data.dataSource.mode).toBe('memory');
    expect(r.body.data.aiService).toMatchObject({ configured: true, reachable: true });
    expect(JSON.stringify(r.body)).not.toContain(AI_KEY);
    expect(r.headers['x-data-source']).toBe('memory');
  });
  it('serves OpenAPI docs', async () => {
    const r = await http().get('/api/docs-json').expect(200);
    expect(Object.keys(r.body.paths)).toEqual(expect.arrayContaining(['/api/v1/memories', '/api/v1/recommendations', '/api/v1/auth/login']));
  });
});

describe('profile', () => {
  it('updates only supported fields with validation', async () => {
    const s = await signup('profile@example.com');
    const r = await http().patch(api('/users/me')).set(auth(s.token)).send({ allergies: ['nuts', 'egg'], diets: ['vegetarian'], preferredLanguage: 'hinglish', matePersona: 'chatpata' }).expect(200);
    expect(r.body.data.profile).toMatchObject({ allergies: ['nuts', 'egg'], diets: ['vegetarian'], preferredLanguage: 'hinglish', matePersona: 'chatpata' });
    await http().patch(api('/users/me')).set(auth(s.token)).send({ allergies: ['chocolate'] }).expect(400);
    await http().patch(api('/users/me')).set(auth(s.token)).send({ email: 'hijack@example.com' }).expect(400);
  });
});

describe('recipes, ingredients, discovery', () => {
  it('lists with pagination and filters', async () => {
    const r = await http().get(api('/recipes?cuisine=Indian&maxTime=20&pageSize=3')).expect(200);
    expect(r.body.meta).toMatchObject({ page: 1, pageSize: 3 });
    expect(r.body.data.every((x: { cuisine: string; totalMin: number }) => x.cuisine === 'Indian' && x.totalMin <= 20)).toBe(true);
    const v = await http().get(api('/recipes?diet=vegan&difficulty=Beginner')).expect(200);
    expect(v.body.data.every((x: { diets: string[] }) => x.diets.includes('vegan'))).toBe(true);
    await http().get(api('/recipes?cuisine=Martian')).expect(400);
    await http().get(api('/recipes?pageSize=500')).expect(400);
  });
  it('searches by ingredient name', async () => {
    const r = await http().get(api('/recipes?q=paneer')).expect(200);
    expect(r.body.data.map((x: { id: string }) => x.id)).toContain('paneer-bhurji');
  });
  it('returns full detail, ingredients and steps', async () => {
    const d = (await http().get(api('/recipes/dal-tadka')).expect(200)).body.data;
    expect(d.ingredients[0]).toHaveProperty('name');
    expect(d.steps[0]).toMatchObject({ index: 0 });
    expect(d).toHaveProperty('allergens');
    expect((await http().get(api('/recipes/dal-tadka/steps')).expect(200)).body.data.length).toBe(d.steps.length);
    expect((await http().get(api('/recipes/no-such-dish')).expect(404)).body.error.code).toBe('NOT_FOUND');
  });
  it('searches ingredients by alias and category', async () => {
    expect((await http().get(api('/ingredients?q=aloo')).expect(200)).body.data[0].id).toBe('potato');
    const spices = (await http().get(api('/ingredients?category=Spices')).expect(200)).body.data;
    expect(spices.every((i: { category: string }) => i.category === 'Spices')).toBe(true);
    expect((await http().get(api('/ingredients/categories')).expect(200)).body.data).toContain('Dairy');
  });
  it('discovery facets come from the catalogue', async () => {
    const d = (await http().get(api('/discovery')).expect(200)).body.data;
    expect(d.cuisines.find((c: { id: string }) => c.id === 'Indian').count).toBeGreaterThan(0);
  });
});

describe('inventory + recommendations', () => {
  let s: Awaited<ReturnType<typeof signup>>;
  beforeAll(async () => { s = await signup('kitchen@example.com'); });

  it('adds (upserting), updates and deletes items', async () => {
    const a = await http().post(api('/inventory')).set(auth(s.token)).send({ ingredientId: 'egg', quantity: 6 }).expect(201);
    expect(a.body.data).toMatchObject({ ingredientId: 'egg', quantity: 6, unit: 'pcs', name: 'Egg' });
    await http().post(api('/inventory')).set(auth(s.token)).send({ ingredientId: 'egg', quantity: 4 }).expect(200);
    expect((await http().get(api('/inventory')).set(auth(s.token))).body.data).toHaveLength(1);
    const id = a.body.data.id;
    expect((await http().patch(api(`/inventory/${id}`)).set(auth(s.token)).send({ quantity: 2, expiresOn: '2020-01-01' }).expect(200)).body.data.expired).toBe(true);
    await http().post(api('/inventory')).set(auth(s.token)).send({ ingredientId: 'unicorn', quantity: 1 }).expect(400);
    await http().post(api('/inventory')).set(auth(s.token)).send({ ingredientId: 'onion', quantity: -1 }).expect(400);
    await http().delete(api(`/inventory/${id}`)).set(auth(s.token)).expect(204);
    await http().delete(api(`/inventory/${id}`)).set(auth(s.token)).expect(404);
  });

  it('recommends with reasons and never returns allergens (anonymous)', async () => {
    const r = await http().post(api('/recommendations')).send({ ingredientIds: ['egg', 'onion', 'tomato', 'green-chilli'], allergies: ['dairy'], includeExcluded: true }).expect(200);
    const res = r.body.data.results;
    expect(res[0].recipe.id).toBe('masala-omelette');
    expect(res[0].reasons.length).toBeGreaterThan(0);
    expect(res.some((x: { recipe: { allergens: string[] } }) => x.recipe.allergens.includes('dairy'))).toBe(false);
    expect(r.body.data.excluded.length).toBe(r.body.data.excludedCount);
  });

  it('signed-in: uses profile allergies and the saved kitchen', async () => {
    await http().patch(api('/users/me')).set(auth(s.token)).send({ allergies: ['egg'] }).expect(200);
    await http().post(api('/inventory')).set(auth(s.token)).send({ ingredientId: 'poha', quantity: 1 }).expect(201);
    const r = await http().post(api('/recommendations')).set(auth(s.token)).send({}).expect(200);
    expect(r.body.data.usedInventory).toBe(true);
    expect(r.body.data.appliedRestrictions.allergies).toContain('egg');
    expect(r.body.data.results.some((x: { recipe: { allergens: string[] } }) => x.recipe.allergens.includes('egg'))).toBe(false);
  });
});

describe('favourites', () => {
  it('adds idempotently, checks status, removes', async () => {
    const s = await signup('fav@example.com');
    await http().post(api('/favourites')).set(auth(s.token)).send({ recipeId: 'poha' }).expect(201);
    await http().post(api('/favourites')).set(auth(s.token)).send({ recipeId: 'poha' }).expect(200);
    expect((await http().get(api('/favourites/poha')).set(auth(s.token))).body.data.favourite).toBe(true);
    expect((await http().get(api('/favourites')).set(auth(s.token))).body.data[0].recipe.id).toBe('poha');
    await http().post(api('/favourites')).set(auth(s.token)).send({ recipeId: 'nope' }).expect(404);
    await http().delete(api('/favourites/poha')).set(auth(s.token)).expect(204);
    expect((await http().get(api('/favourites/poha')).set(auth(s.token))).body.data.favourite).toBe(false);
  });
});

describe('cooking sessions', () => {
  it('tracks progress and finishes', async () => {
    const s = await signup('cook@example.com');
    const start = await http().post(api('/cooking-sessions')).set(auth(s.token)).send({ recipeId: 'poha' }).expect(201);
    const id = start.body.data.id;
    expect(start.body.data).toMatchObject({ status: 'active', currentStep: 0, completedSteps: 0 });
    await http().post(api('/cooking-sessions')).set(auth(s.token)).send({ recipeId: 'poha' }).expect(200); // resumes
    const c = await http().post(api(`/cooking-sessions/${id}/steps/0/complete`)).set(auth(s.token)).expect(201);
    expect(c.body.data).toMatchObject({ currentStep: 1, completedSteps: 1 });
    await http().patch(api(`/cooking-sessions/${id}`)).set(auth(s.token)).send({ currentStep: 99 }).expect(400);
    expect((await http().get(api('/cooking-sessions/active')).set(auth(s.token))).body.data.id).toBe(id);
    await http().post(api(`/cooking-sessions/${id}/complete`)).set(auth(s.token)).expect(201);
    expect((await http().post(api(`/cooking-sessions/${id}/complete`)).set(auth(s.token)).expect(409)).body.error.code).toBe('SESSION_NOT_ACTIVE');
    expect((await http().get(api('/cooking-sessions/active')).set(auth(s.token))).body.data).toBeNull();
  });
  it('starting another recipe abandons the previous session', async () => {
    const s = await signup('switch@example.com');
    const a = (await http().post(api('/cooking-sessions')).set(auth(s.token)).send({ recipeId: 'poha' })).body.data.id;
    await http().post(api('/cooking-sessions')).set(auth(s.token)).send({ recipeId: 'dal-tadka' }).expect(201);
    expect((await http().get(api(`/cooking-sessions/${a}`)).set(auth(s.token))).body.data.status).toBe('abandoned');
  });
});

describe('ownership', () => {
  it("a user can never see or change another user's data", async () => {
    const a = await signup('owner-a@example.com');
    const b = await signup('owner-b@example.com');
    const item = (await http().post(api('/inventory')).set(auth(a.token)).send({ ingredientId: 'rice', quantity: 1 })).body.data.id;
    const sess = (await http().post(api('/cooking-sessions')).set(auth(a.token)).send({ recipeId: 'poha' })).body.data.id;
    const mem = (await http().post(api('/memories')).set(auth(a.token)).field('dish', 'Secret dal').attach('photos', JPEG, 'a.jpg')).body.data.id;
    await http().patch(api(`/inventory/${item}`)).set(auth(b.token)).send({ quantity: 9 }).expect(404);
    await http().delete(api(`/inventory/${item}`)).set(auth(b.token)).expect(404);
    await http().get(api(`/cooking-sessions/${sess}`)).set(auth(b.token)).expect(404);
    await http().get(api(`/memories/${mem}`)).set(auth(b.token)).expect(404);
    await http().delete(api(`/memories/${mem}`)).set(auth(b.token)).expect(404);
    expect((await http().get(api('/memories')).set(auth(b.token))).body.data).toHaveLength(0);
    expect((await http().get(api('/inventory')).set(auth(b.token))).body.data).toHaveLength(0);
  });
});

describe('Tastory memories', () => {
  let s: Awaited<ReturnType<typeof signup>>;
  beforeAll(async () => { s = await signup('tastory@example.com'); });

  it('requires a dish and at least one real photo', async () => {
    expect((await http().post(api('/memories')).set(auth(s.token)).field('dish', 'Dal').expect(400)).body.error.code).toBe('PHOTO_REQUIRED');
    await http().post(api('/memories')).set(auth(s.token)).attach('photos', JPEG, 'a.jpg').expect(400);
    const fake = await http().post(api('/memories')).set(auth(s.token)).field('dish', 'Dal').attach('photos', Buffer.from('not really an image, just text....'), { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(415);
    expect(fake.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    const future = await http().post(api('/memories')).set(auth(s.token)).field('dish', 'Dal').field('date', '2999-01-01').attach('photos', JPEG, 'a.jpg').expect(400);
    expect(future.body.error.code).toBe('DATE_IN_FUTURE');
  });

  it('rejects oversized photos', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(16 * 1024 * 1024)]);
    const r = await http().post(api('/memories')).set(auth(s.token)).field('dish', 'Big').attach('photos', big, 'big.jpg').expect(413);
    expect(r.body.error.code).toBe('FILE_TOO_LARGE');
  });

  let id: string;
  it('creates, reads back private photos through signed URLs only', async () => {
    const r = await http().post(api('/memories')).set(auth(s.token))
      .field('dish', 'Rajma Chawal').field('date', '2026-10-30').field('caption', 'Rainy evening').field('notes', 'kasuri methi').field('rating', '4')
      .field('tags', '["comfort","Weeknight"]').field('favourite', 'true').attach('photos', JPEG, 'a.jpg').attach('photos', PNG, 'b.png').expect(201);
    const m = r.body.data;
    id = m.id;
    expect(m).toMatchObject({ dish: 'Rajma Chawal', rating: 4, tags: ['comfort', 'weeknight'], favourite: true });
    expect(m.photos).toHaveLength(2);
    expect(m.coverPhotoId).toBe(m.photos[0].id);
    expect(JSON.stringify(m)).not.toContain('storageKey');
    const img = await http().get(m.photos[1].url).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(img.body, PNG)).toBe(0);
    await http().get(m.photos[1].url.replace(/sig=[^&]+/, 'sig=forged')).expect(403);
    await http().get(m.photos[1].url.replace(/exp=\d+/, 'exp=1')).expect(403);
  });

  it('edits, favourites, reorders, sets cover, adds and removes photos', async () => {
    expect((await http().patch(api(`/memories/${id}`)).set(auth(s.token)).send({ caption: 'Edited', rating: null }).expect(200)).body.data).toMatchObject({ caption: 'Edited', rating: null });
    expect((await http().patch(api(`/memories/${id}/favourite`)).set(auth(s.token)).send({}).expect(200)).body.data.favourite).toBe(false);
    const m = (await http().get(api(`/memories/${id}`)).set(auth(s.token))).body.data;
    const [p1, p2] = m.photos.map((p: { id: string }) => p.id);
    expect((await http().patch(api(`/memories/${id}/cover`)).set(auth(s.token)).send({ photoId: p2 }).expect(200)).body.data.coverPhotoId).toBe(p2);
    expect((await http().patch(api(`/memories/${id}/photos/order`)).set(auth(s.token)).send({ photoIds: [p1, p2] }).expect(200)).body.data.coverPhotoId).toBe(p1);
    await http().patch(api(`/memories/${id}/photos/order`)).set(auth(s.token)).send({ photoIds: [p1] }).expect(400);
    expect((await http().post(api(`/memories/${id}/photos`)).set(auth(s.token)).attach('photos', JPEG, 'c.jpg').expect(201)).body.data.photos).toHaveLength(3);
    await http().delete(api(`/memories/${id}/photos/${p1}`)).set(auth(s.token)).expect(200);
    await http().delete(api(`/memories/${id}/photos/${p2}`)).set(auth(s.token)).expect(200);
    const last = (await http().get(api(`/memories/${id}`)).set(auth(s.token))).body.data.photos[0].id;
    expect((await http().delete(api(`/memories/${id}/photos/${last}`)).set(auth(s.token)).expect(409)).body.error.code).toBe('LAST_PHOTO');
  });

  it('searches, filters, sorts, groups by month and counts', async () => {
    await http().post(api('/memories')).set(auth(s.token)).field('dish', 'Aloo Paratha').field('date', '2026-08-15').field('rating', '5').field('tags', 'breakfast').attach('photos', JPEG, 'p.jpg').expect(201);
    const q = (p: string) => http().get(api(`/memories${p}`)).set(auth(s.token)).then((r) => r.body);
    expect((await q('?q=kasuri')).data.map((m: { dish: string }) => m.dish)).toEqual(['Rajma Chawal']);
    expect((await q('?q=breakfast')).data).toHaveLength(1);
    expect((await q('?filter=top')).data.map((m: { dish: string }) => m.dish)).toEqual(['Aloo Paratha']);
    expect((await q('?sort=az')).data[0].dish).toBe('Aloo Paratha');
    expect((await q('?sort=oldest')).data[0].dish).toBe('Aloo Paratha');
    expect((await q('?pageSize=1')).meta).toMatchObject({ total: 2, totalPages: 2 });
    const t = (await q('/timeline')).data;
    expect(t.groups.map((g: { month: string }) => g.month)).toEqual(['2026-10', '2026-08']);
    expect((await q('/statistics')).data).toMatchObject({ memories: 2, photos: 2, latestDate: '2026-10-30' });
  });

  it('deletes a memory and its photos', async () => {
    const url = (await http().get(api(`/memories/${id}`)).set(auth(s.token))).body.data.photos[0].url;
    await http().delete(api(`/memories/${id}`)).set(auth(s.token)).expect(204);
    await http().get(api(`/memories/${id}`)).set(auth(s.token)).expect(404);
    await http().get(url).expect(404); // file removed from storage
  });
});

describe('scanner', () => {
  it('validates the upload before calling AI', async () => {
    const before = ai.calls.length;
    expect((await http().post(api('/scanner/ingredients')).expect(400)).body.error.code).toBe('INVALID_IMAGE');
    await http().post(api('/scanner/ingredients')).attach('image', Buffer.from('GIF89a................'), 'x.gif').expect(415);
    await http().post(api('/scanner/ingredients')).attach('image', Buffer.concat([JPEG, Buffer.alloc(9 * 1024 * 1024)]), 'big.jpg').expect(413);
    expect(ai.calls.length).toBe(before);
  });
  it('maps labels, keeps uncertain ones unconfirmed, reports unknowns', async () => {
    ai.respond('/v1/vision/ingredients', 200, { detections: [{ label: 'tomatoes', confidence: 0.93 }, { label: 'red onion', confidence: 0.55 }, { label: 'dragon fruit', confidence: 0.9 }, { label: 'tomato', confidence: 0.4 }] });
    const r = (await http().post(api('/scanner/ingredients')).attach('image', JPEG, 'fridge.jpg').expect(200)).body.data;
    expect(r.requiresConfirmation).toBe(true);
    expect(r.detections).toEqual([
      expect.objectContaining({ ingredientId: 'tomato', confidence: 0.93, status: 'likely' }),
      expect.objectContaining({ ingredientId: 'onion', confidence: 0.55, status: 'uncertain' }),
    ]);
    expect(r.unmatched).toEqual([{ label: 'dragon fruit', confidence: 0.9 }]);
    expect(ai.calls.at(-1)!.key).toBe(AI_KEY);
  });
  it('turns AI failures into explicit errors', async () => {
    ai.respond('/v1/vision/ingredients', 503, { detail: { code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'No AI model key' } });
    expect((await http().post(api('/scanner/ingredients')).attach('image', JPEG, 'f.jpg').expect(503)).body.error.code).toBe('AI_PROVIDER_NOT_CONFIGURED');
    ai.respond('/v1/vision/ingredients', 500, {});
    expect((await http().post(api('/scanner/ingredients')).attach('image', JPEG, 'f.jpg').expect(502)).body.error.code).toBe('AI_SERVICE_ERROR');
  });
});

describe('Cooking Mate', () => {
  it('sends compact recipe context and returns the reply', async () => {
    ai.respond('/v1/mate/chat', 200, { reply: 'Golden means deep amber, about 8 minutes.', action: null, goToStep: null, timerSeconds: null, swap: null, model: 'fake' });
    const r = await http().post(api('/cooking-mate/chat')).send({ message: 'how golden?', recipeId: 'dal-tadka', stepIndex: 1, allergies: ['nuts'] }).expect(200);
    expect(r.body.data).toMatchObject({ reply: expect.stringContaining('Golden'), source: 'ai' });
    const sent = ai.calls.at(-1)!.body as { recipe: { name: string; steps: unknown[] }; allergies: string[] };
    expect(sent.recipe.name).toBe('Dal Tadka');
    expect(sent.allergies).toEqual(['nuts']);
  });
  it('fails honestly', async () => {
    ai.respond('/v1/mate/chat', 422, { detail: { code: 'AI_INVALID_OUTPUT' } });
    expect((await http().post(api('/cooking-mate/chat')).send({ message: 'hi' }).expect(502)).body.error.code).toBe('AI_INVALID_OUTPUT');
    await http().post(api('/cooking-mate/chat')).send({ message: '' }).expect(400);
    await http().post(api('/cooking-mate/chat')).send({ message: 'hi', recipeId: 'dal-tadka', stepIndex: 50 }).expect(400);
  });
});

describe('Cook & Chill', () => {
  // dal-tadka step 0 = pressure-cook (passive, 720 s); step 2 = heat oil + cumin crackle (critical)
  it('refuses during a critical step without calling AI', async () => {
    const before = ai.calls.length;
    const r = await http().post(api('/cook-and-chill/activity')).send({ activity: 'jokes', recipeId: 'dal-tadka', stepIndex: 2, remainingSec: 300 }).expect(409);
    expect(r.body.error.code).toBe('COOKING_ATTENTION_REQUIRED');
    expect(ai.calls.length).toBe(before);
  });
  it('refuses in the wrap-up window and when there is not enough time', async () => {
    expect((await http().post(api('/cook-and-chill/activity')).send({ activity: 'jokes', recipeId: 'dal-tadka', stepIndex: 0, remainingSec: 30 }).expect(409)).body.error.code).toBe('WRAP_UP');
    expect((await http().post(api('/cook-and-chill/activity')).send({ activity: 'story', recipeId: 'dal-tadka', stepIndex: 0, remainingSec: 100 }).expect(409)).body.error.code).toBe('NOT_ENOUGH_TIME');
  });
  it('generates content during a safe wait', async () => {
    ai.respond('/v1/chill/activity', 200, { source: 'ai', data: { id: 'j1', setup: 'Why?', punchline: 'Because.', category: 'dal' } });
    const r = await http().post(api('/cook-and-chill/activity')).send({ activity: 'jokes', recipeId: 'dal-tadka', stepIndex: 0, remainingSec: 600 }).expect(200);
    expect(r.body.data).toMatchObject({ source: 'ai', data: { punchline: 'Because.' }, safety: { level: 'passive', note: expect.stringContaining('whistles') } });
    expect((ai.calls.at(-1)!.body as { ctx: { recipeName: string } }).ctx.recipeName).toBe('Dal Tadka');
  });
  it('does not generate Food Facts', async () => {
    await http().post(api('/cook-and-chill/activity')).send({ activity: 'facts', recipeId: 'dal-tadka', stepIndex: 0, remainingSec: 600 }).expect(400);
  });
});
