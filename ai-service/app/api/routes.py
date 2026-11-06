from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, UploadFile

from ..core.config import get_settings
from ..core.errors import InvalidOutput, err
from ..core.security import require_internal_key
from ..integrations.llm import LLM, Image, Turn, get_llm
from ..schemas.chill import ChillRequest
from ..schemas.mate import MateReply, MateRequest, VisionReply
from ..services import chill, mate, vision

log = logging.getLogger("ai.api")

public = APIRouter()
internal = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_key)])


@public.get("/health")
def health():
    s = get_settings()
    return {"status": "ok", "providers": {"active": s.provider, "gemini": bool(s.gemini_key), "claude": bool(s.anthropic_key)}, "serviceKeyConfigured": bool(s.service_key)}


@internal.post("/mate/chat", response_model=MateReply)
async def mate_chat(r: MateRequest, llm: LLM = Depends(get_llm)):
    turns = [Turn("user" if t.who == "user" else "assistant", t.text) for t in r.history[-12:] if t.text.strip()]
    turns.append(Turn("user", r.message))
    raw, model = await llm.complete_json(mate.system_prompt(r), turns, mate.SCHEMA, mate.KEYS, temperature=1.0 if r.persona == "chatpata" else 0.8, max_tokens=800)
    out = mate.to_reply(raw, r)
    if not out:
        raise InvalidOutput("empty reply")
    return {**out, "model": model}


@internal.post("/chill/activity")
async def chill_activity(r: ChillRequest, llm: LLM = Depends(get_llm)):
    text, temperature, hist = chill.instruction(r)
    turns = [Turn("user" if w == "user" else "assistant", t) for w, t in hist]
    # the instruction rides along with the user's last chat message, or is its own user turn
    if turns and turns[-1].role == "user":
        turns[-1] = Turn("user", f"{turns[-1].text}\n\n[{text}]")
    else:
        turns.append(Turn("user", text))
    schema, keys = chill.SCHEMAS[r.activity]
    raw, model = await llm.complete_json(chill.system_prompt(r.ctx), turns, schema, keys, temperature=temperature, max_tokens=1024)
    data = chill.validate(r, raw)
    if data is None:
        log.warning("chill %s: output failed validation", r.activity)
        raise InvalidOutput(r.activity)
    return {"source": "ai", "data": data, "model": model}


@internal.post("/vision/ingredients", response_model=VisionReply)
async def vision_ingredients(image: UploadFile = File(...), llm: LLM = Depends(get_llm)):
    data = await image.read(vision.MAX_BYTES + 1)
    if len(data) > vision.MAX_BYTES:
        raise err(413, "FILE_TOO_LARGE", "The photo is larger than 8 MB.")
    mime = vision.sniff(data)
    if not mime:
        raise err(415, "UNSUPPORTED_MEDIA_TYPE", "Send a JPG, PNG or WebP photo.")
    raw, model = await llm.complete_json(vision.SYSTEM, [Turn("user", "List the ingredients you can see in this photo.")], vision.SCHEMA, vision.KEYS,
                                         temperature=0.2, max_tokens=900, image=Image(data, mime))
    return {"detections": vision.clean(raw), "model": model}
