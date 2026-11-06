# RANNAMATE — AI service (FastAPI)

Internal service called **only by the NestJS backend**. It turns a prompt + context into validated JSON.
It has no database access and stores nothing.

| Route | Purpose |
|---|---|
| `GET /health` | public; which model provider is configured (booleans only) |
| `POST /v1/mate/chat` | Cooking Mate reply for the recipe/step the backend sends |
| `POST /v1/chill/activity` | one Cook & Chill item (trivia, guess, would-you-rather + reaction, joke, riddle, chat, story beat, original song) — validated before it leaves |
| `POST /v1/vision/ingredients` | ingredient labels + confidence from a JPG/PNG/WebP photo (≤ 8 MB) |

Every `/v1` route requires the header `X-Internal-Key` = `AI_SERVICE_API_KEY` (same value as in `backend/.env`).

**No fake answers:** without a model key → `503 AI_PROVIDER_NOT_CONFIGURED`; the model failing → `502 AI_PROVIDER_ERROR`;
output that fails validation (e.g. a trivia question with duplicate options, a riddle containing its own answer,
an ingredient clue that names the ingredient) → `422 AI_INVALID_OUTPUT`. The backend turns these into its own error codes, and the app falls back to its labelled offline content.

Food Facts are never generated; they come from the app's curated library. Song prompts forbid existing lyrics and imitating real artists.

## Run

Python 3.11+.

```bash
cd ai-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # set AI_SERVICE_API_KEY and GEMINI_API_KEY (or ANTHROPIC_API_KEY)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Docs at `http://127.0.0.1:8000/docs`. Bind to `127.0.0.1` so only the backend on the same machine can reach it.

## Structure

```
app/
├─ main.py              app factory, error mapping
├─ api/routes.py        HTTP routes
├─ core/                settings (.env), internal-key check, errors
├─ integrations/llm.py  Gemini / Claude providers behind one `complete_json` interface
├─ schemas/             request/response models (pydantic)
└─ services/            mate.py · chill.py (prompts + validators) · vision.py
tests/                  pytest — a fake model injected via dependency override (tests only)
```

## Test

```bash
pip install -r requirements-dev.txt
pytest -q
```
