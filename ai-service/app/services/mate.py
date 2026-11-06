"""Cooking Mate: answers questions about the recipe and step the user is on."""
from __future__ import annotations

from typing import Any

from ..schemas.mate import MateRequest

PERSONA = {
    "mild": "Calm, warm and clear, like a patient home-cooking teacher. Minimal emoji.",
    "masala": "Friendly, upbeat and playful, like a fun friend who loves cooking. A couple of emoji are fine.",
    "chatpata": "Extra chatpata: dramatic, funny, high-energy Indian street-food-vendor energy with food puns and emoji. Still genuinely useful.",
}
ACTIONS = ["next", "prev", "repeat", "start-timer", "pause-timer"]
SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING", "description": "What Mate says (spoken aloud). 1-4 short sentences, no markdown."},
        "action": {"type": "STRING", "enum": ACTIONS + ["none"], "description": "Cooking-mode navigation the user asked for, or none."},
        "goToStep": {"type": "INTEGER", "description": "1-based step to show, 0 if none."},
        "timerSeconds": {"type": "INTEGER", "description": "Suggested timer length when the user asks for a timer, 0 if none."},
        "swapFrom": {"type": "STRING"},
        "swapOptions": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["reply"],
}
KEYS = "reply, action (next|prev|repeat|start-timer|pause-timer|none), goToStep, timerSeconds, swapFrom, swapOptions[]"


def system_prompt(r: MateRequest) -> str:
    if r.recipe:
        rc = r.recipe
        step = f"The user is on step {r.stepIndex + 1} of {len(rc.steps)}." if r.stepIndex is not None and rc.steps else "Not cooking yet."
        steps = "\n".join(f"{i + 1}. {s.text}" + (f" [~{s.timerSeconds}s]" if s.timerSeconds else "") for i, s in enumerate(rc.steps))
        recipe = f"""CURRENT RECIPE: {rc.name}{f", serves {rc.servings}" if rc.servings else ""}. {step}
Ingredients: {"; ".join(rc.ingredients)}
Steps:
{steps}
Known swaps: {"; ".join(rc.substitutions) or "none listed"}"""
    else:
        recipe = "No recipe selected."
    return f"""You are "Mate", the talking cooking companion inside the RANNAMATE app — an experienced home cook who knows Indian and world cuisines.
Personality: {PERSONA[r.persona]}
Language for "reply": {"casual Hinglish (Hindi in Roman script mixed with English)" if r.lang == "hinglish" else "English (an occasional Hindi food word is fine)"}.
"reply" is read aloud: 1-4 short sentences, max ~70 words, no markdown, no lists.

HARD SAFETY RULES: never suggest these allergens in any form: {", ".join(r.allergies) or "none"}. Diet: {", ".join(r.diets) or "no restriction"}.
Always give safe cooking guidance (cook meat and eggs through, warn about hot oil and steam). Never claim food is done — tell the user how to check it.

{recipe}

HOW TO ANSWER
- Explain techniques, clarify measurements, troubleshoot problems and suggest substitutions using the recipe above.
- If they ask to go to the next/previous step or repeat it, set action and goToStep (1-based) and read that step in reply.
- If they ask for a timer, set action "start-timer" and timerSeconds. The app's own timer does the counting.
- Substitutions → swapFrom + swapOptions.
- Off-topic questions: answer in one line and steer back to the food."""


def to_reply(raw: dict[str, Any], r: MateRequest) -> dict[str, Any] | None:
    reply = str(raw.get("reply") or "").strip()[:700]
    if not reply:
        return None
    steps = len(r.recipe.steps) if r.recipe else 0
    action = raw.get("action") if raw.get("action") in ACTIONS else None
    go = raw.get("goToStep")
    go = go - 1 if isinstance(go, int) and not isinstance(go, bool) and 1 <= go <= steps else None  # → 0-based
    t = raw.get("timerSeconds")
    t = t if isinstance(t, int) and not isinstance(t, bool) and 0 < t <= 7200 else None
    opts = [str(o).strip()[:80] for o in (raw.get("swapOptions") or []) if str(o).strip()][:4]
    swap = {"from": str(raw.get("swapFrom")).strip()[:60], "options": opts} if raw.get("swapFrom") and opts else None
    return {"reply": reply, "action": action, "goToStep": go, "timerSeconds": t, "swap": swap}
