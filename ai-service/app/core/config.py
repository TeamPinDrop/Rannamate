"""Settings from the environment (and an optional .env file). No secrets have defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    service_key: str
    gemini_key: str
    gemini_model: str | None
    anthropic_key: str
    anthropic_model: str
    request_budget_s: float = 22.0

    @property
    def provider(self) -> str | None:
        return "gemini" if self.gemini_key else "claude" if self.anthropic_key else None


@lru_cache
def get_settings() -> Settings:
    _load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    e = os.environ.get
    return Settings(
        service_key=(e("AI_SERVICE_API_KEY") or "").strip(),
        gemini_key=(e("GEMINI_API_KEY") or "").strip(),
        gemini_model=(e("GEMINI_MODEL") or "").strip() or None,
        anthropic_key=(e("ANTHROPIC_API_KEY") or "").strip(),
        anthropic_model=(e("ANTHROPIC_MODEL") or "claude-haiku-5-5").strip(),
    )
