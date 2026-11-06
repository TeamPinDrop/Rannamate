"""Ingredient photo recognition through a multimodal model. Returns raw labels + confidences;
the backend maps them to its catalogue and the user confirms every one."""
from __future__ import annotations

from typing import Any

SYSTEM = """You identify raw cooking ingredients visible in a photo of a fridge, counter or shopping bag.
Rules:
- List only ingredients you can actually see. Do not guess hidden items or infer from packaging you cannot read.
- Use simple common names in English (e.g. "tomato", "green chilli", "paneer", "onion").
- confidence is 0..1: how sure you are the item is present AND correctly named. Use < 0.6 when unsure.
- If the photo contains no recognisable food ingredients, return an empty list.
- Maximum 25 items. No prepared dishes, utensils or brands."""

SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {"detections": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"label": {"type": "STRING"}, "confidence": {"type": "NUMBER"}}, "required": ["label", "confidence"]}}},
    "required": ["detections"],
}
KEYS = "detections[{label, confidence 0..1}]"
OK_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 8 * 1024 * 1024


def sniff(b: bytes) -> str | None:
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


def clean(raw: dict[str, Any]) -> list[dict[str, Any]]:
    out: dict[str, float] = {}
    for d in raw.get("detections") or []:
        if not isinstance(d, dict):
            continue
        label = " ".join(str(d.get("label") or "").split())[:60].lower()
        try:
            c = float(d.get("confidence"))
        except (TypeError, ValueError):
            continue
        if not label or c != c:  # NaN
            continue
        c = max(0.0, min(1.0, c))
        out[label] = max(out.get(label, 0.0), c)
    return [{"label": k, "confidence": round(v, 3)} for k, v in sorted(out.items(), key=lambda x: -x[1])][:25]
