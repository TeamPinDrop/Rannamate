"""Test-only fakes. The fake model is injected via FastAPI's dependency override — production never uses it."""
import os

import pytest
from fastapi.testclient import TestClient

os.environ["AI_SERVICE_API_KEY"] = "test-internal-key"
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("ANTHROPIC_API_KEY", None)

from app.core.config import get_settings  # noqa: E402
from app.integrations.llm import get_llm  # noqa: E402
from app.main import app  # noqa: E402

get_settings.cache_clear()
KEY = {"X-Internal-Key": "test-internal-key"}


class FakeLLM:
    name = "fake"

    def __init__(self, reply):
        self.reply, self.calls = reply, []

    async def complete_json(self, system, turns, schema, keys_hint, **kw):
        self.calls.append({"system": system, "turns": turns, "kw": kw})
        return (self.reply(len(self.calls)) if callable(self.reply) else self.reply), "fake-model"


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def fake(client):
    def install(reply):
        f = FakeLLM(reply)
        app.dependency_overrides[get_llm] = lambda: f
        return f
    return install


CTX = {"recipeName": "Dal Tadka", "cuisine": "Indian", "stepText": "Pressure-cook the dal", "remainingSec": 600, "ingredients": ["Toor dal", "Garlic"]}
