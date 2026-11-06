"""
Model providers. One interface — `complete_json` — used by every feature:
system prompt + conversation (+ optional image) in, a parsed JSON object out.

Gemini is preferred (structured output via responseSchema); Claude is the alternative.
Nothing here returns made-up content: missing keys → ProviderNotConfigured,
transport/model failures → ProviderError, unparsable output → InvalidOutput.
"""
from __future__ import annotations

import base64
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from ..core.config import Settings, get_settings
from ..core.errors import InvalidOutput, ProviderError, ProviderNotConfigured

log = logging.getLogger("ai.llm")

GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"]
_cooled: dict[str, float] = {}  # models that reported quota exhaustion → skip until timestamp


@dataclass
class Turn:
    role: str  # "user" | "assistant"
    text: str


@dataclass
class Image:
    data: bytes
    mime: str


class LLM(Protocol):
    name: str

    async def complete_json(self, system: str, turns: list[Turn], schema: dict[str, Any], keys_hint: str, *, temperature: float = 0.8,
                            max_tokens: int = 1024, image: Image | None = None) -> tuple[dict[str, Any], str]: ...


def parse_json(text: str) -> dict[str, Any]:
    try:
        start, end = text.index("{"), text.rindex("}") + 1
        obj = json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError) as e:
        raise InvalidOutput("model did not return JSON") from e
    if not isinstance(obj, dict):
        raise InvalidOutput("model JSON is not an object")
    return obj


class Gemini:
    name = "gemini"

    def __init__(self, s: Settings):
        self.key = s.gemini_key
        self.models = ([s.gemini_model] if s.gemini_model else []) + GEMINI_MODELS
        self.budget = s.request_budget_s

    async def complete_json(self, system, turns, schema, keys_hint, *, temperature=0.8, max_tokens=1024, image=None):
        contents = [{"role": "user" if t.role == "user" else "model", "parts": [{"text": t.text}]} for t in turns]
        if image is not None and contents:
            contents[-1]["parts"].insert(0, {"inline_data": {"mime_type": image.mime, "data": base64.b64encode(image.data).decode()}})
        deadline = time.monotonic() + self.budget
        last = "Gemini did not answer"
        usable = [m for m in self.models if _cooled.get(m, 0) < time.time()] or self.models
        async with httpx.AsyncClient() as client:
            for i, model in enumerate(usable):
                left = deadline - time.monotonic()
                if left < 3:
                    break
                body = {
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": contents,
                    "generationConfig": {
                        "temperature": temperature, "maxOutputTokens": max_tokens, "responseMimeType": "application/json", "responseSchema": schema,
                        **({"thinkingConfig": {"thinkingLevel": "low"}} if model.startswith("gemini-3") else {}),
                    },
                }
                try:
                    r = await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                          headers={"x-goog-api-key": self.key}, json=body, timeout=min(left, 16 if i == 0 else 10))
                except httpx.HTTPError as e:
                    last = f"can't reach Gemini ({type(e).__name__})"
                    log.warning("%s: %s", model, last)
                    continue
                data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
                if r.status_code == 200:
                    text = "".join(p.get("text", "") for p in (data.get("candidates") or [{}])[0].get("content", {}).get("parts", []))
                    if text.strip():
                        return parse_json(text), model
                    last = "Gemini returned an empty answer"
                    continue
                msg = (data.get("error") or {}).get("message", f"HTTP {r.status_code}")
                log.warning("%s: HTTP %s %s", model, r.status_code, msg[:160])
                last = msg
                if r.status_code in (401, 403) or (r.status_code == 400 and "model" not in msg.lower()):
                    raise ProviderError(f"Gemini rejected the request: {msg[:120]}")
                if r.status_code == 429 and any(w in msg.lower() for w in ("quota", "per day", "limit")):
                    _cooled[model] = time.time() + (3600 if "day" in msg.lower() else 60)
        raise ProviderError(last)


class Claude:
    name = "claude"

    def __init__(self, s: Settings):
        self.key, self.model, self.budget = s.anthropic_key, s.anthropic_model, s.request_budget_s

    async def complete_json(self, system, turns, schema, keys_hint, *, temperature=0.8, max_tokens=1024, image=None):
        msgs: list[dict[str, Any]] = [{"role": "user" if t.role == "user" else "assistant", "content": t.text} for t in turns]
        while msgs and msgs[0]["role"] != "user":
            msgs.pop(0)
        if image is not None and msgs:
            msgs[-1]["content"] = [
                {"type": "image", "source": {"type": "base64", "media_type": image.mime, "data": base64.b64encode(image.data).decode()}},
                {"type": "text", "text": msgs[-1]["content"]},
            ]
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post("https://api.anthropic.com/v1/messages", timeout=self.budget, headers={
                    "x-api-key": self.key, "anthropic-version": "2023-06-01", "content-type": "application/json",
                }, json={"model": self.model, "max_tokens": max_tokens, "temperature": min(1.0, temperature),
                         "system": f"{system}\n\nRespond with ONLY a JSON object (no prose) with keys: {keys_hint}.", "messages": msgs})
        except httpx.HTTPError as e:
            raise ProviderError(f"can't reach Claude ({type(e).__name__})") from e
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code != 200:
            raise ProviderError((data.get("error") or {}).get("message", f"HTTP {r.status_code}")[:160])
        return parse_json("".join(c.get("text", "") for c in data.get("content", []))), self.model


def get_llm() -> LLM:
    """FastAPI dependency. Tests override it with a fake; production never falls back to canned answers."""
    s = get_settings()
    if s.provider == "gemini":
        return Gemini(s)
    if s.provider == "claude":
        return Claude(s)
    raise ProviderNotConfigured()
