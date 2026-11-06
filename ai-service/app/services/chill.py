"""
Cook & Chill content generation — prompts, response schemas and output validation for the eight
generated activities (Food Facts stay in the app's curated library and are never generated).
Ported from frontend/src/app/api/mate/chill/route.ts + lib/chill/engine.ts so both paths behave the same.
"""
from __future__ import annotations

import random
import re
import time
import unicodedata
from typing import Any

from ..core.errors import InvalidOutput
from ..schemas.chill import ChillContext, ChillRequest

PERSONA = {
    "mild": "calm, warm and gentle; minimal emoji",
    "masala": "friendly, upbeat and playful; a couple of emoji are fine",
    "chatpata": "dramatic, funny, high-energy street-food-vendor energy with food puns; still kind",
}

S = {"type": "STRING"}
A = {"type": "ARRAY", "items": S}
SCHEMAS: dict[str, tuple[dict[str, Any], str]] = {
    "trivia": ({"type": "OBJECT", "properties": {"question": S, "options": A, "correctIndex": {"type": "INTEGER"}, "explanation": S, "difficulty": {"type": "STRING", "enum": ["easy", "medium", "hard"]}, "topic": S}, "required": ["question", "options", "correctIndex", "explanation"]}, "question, options[4], correctIndex (0-3), explanation, difficulty, topic"),
    "guess": ({"type": "OBJECT", "properties": {"answer": S, "aliases": A, "clues": A, "emoji": S}, "required": ["answer", "aliases", "clues", "emoji"]}, "answer, aliases[], clues[3], emoji"),
    "wyr": ({"type": "OBJECT", "properties": {"optionA": S, "optionB": S, "emojiA": S, "emojiB": S}, "required": ["optionA", "optionB"]}, "optionA, optionB, emojiA, emojiB"),
    "wyr-react": ({"type": "OBJECT", "properties": {"reaction": S, "followUp": S}, "required": ["reaction"]}, "reaction, followUp"),
    "jokes": ({"type": "OBJECT", "properties": {"setup": S, "punchline": S, "category": S}, "required": ["setup", "punchline"]}, "setup, punchline, category"),
    "riddles": ({"type": "OBJECT", "properties": {"riddle": S, "answer": S, "aliases": A, "hint": S, "difficulty": {"type": "STRING", "enum": ["easy", "medium", "hard"]}}, "required": ["riddle", "answer", "aliases", "hint"]}, "riddle, answer, aliases[], hint, difficulty"),
    "chat": ({"type": "OBJECT", "properties": {"reply": S, "cookingQuestion": {"type": "BOOLEAN"}}, "required": ["reply", "cookingQuestion"]}, "reply, cookingQuestion (boolean)"),
    "story": ({"type": "OBJECT", "properties": {"title": S, "text": S, "choices": A, "ending": {"type": "BOOLEAN"}}, "required": ["title", "text", "choices", "ending"]}, "title, text, choices[2], ending (boolean)"),
    "song": ({"type": "OBJECT", "properties": {"title": S, "style": S, "lines": A}, "required": ["title", "style", "lines"]}, "title, style, lines[]"),
}


def clip(v: Any, n: int) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]


def system_prompt(c: ChillContext) -> str:
    return f"""You are "Mate", the friendly AI cooking companion inside the RANNAMATE app, now in COOK & CHILL mode: the user's food is cooking and they're waiting, so you keep them entertained for a few minutes.
Personality: {PERSONA.get(c.persona, PERSONA['masala'])}.
Language: {"casual Hinglish (Hindi in Roman script mixed with English)" if c.lang == "hinglish" else "English (an occasional Hindi food word is fine)"}.
Everything you write is shown on screen and may be read aloud: short, plain text, no markdown.

CONTEXT
Cooking: {c.recipeName}{f" ({c.cuisine})" if c.cuisine else ""}. Current step: "{clip(c.stepText, 300)}". Time left on the user's timer: about {max(1, round(c.remainingSec / 60))} min.
Ingredients in this recipe: {", ".join(c.ingredients) or "unknown"}.

RULES
- Family-friendly. No offensive, mean or adult humour; no stereotypes about any region, religion, caste, gender or nationality.
- Facts (trivia answers, explanations, ingredient clues) must be well-established and verifiable. If you're not sure something is true, pick a different question.
- Never reproduce, quote or parody existing songs, lyrics, poems, books or films, and never imitate a specific real artist. Everything creative must be original.
- You never control the cooking timer and you never tell the user the food is done — they must always check it themselves.
- Respond with JSON matching the requested schema only."""


def _avoid(recent: list[str]) -> str:
    return f" Do NOT repeat any of these recent items: {'; '.join(repr(clip(r, 90)) for r in recent[:15])}." if recent else ""


def story_max(r: ChillRequest) -> int:
    return max(2, min(4, r.maxBeats or (4 if r.ctx.remainingSec >= 480 else 3 if r.ctx.remainingSec >= 240 else 2)))


def instruction(r: ChillRequest) -> tuple[str, float, list[tuple[str, str]]]:
    """→ (instruction text, temperature, prior conversation turns)"""
    c, a = r.ctx, r.activity
    if a == "trivia":
        return (f"Ask ONE {r.difficulty or 'medium'} multiple-choice food trivia question. Vary the topic among Indian cuisine, world cuisines, food history, ingredients, cooking techniques, spices and herbs, famous dishes and food traditions — sometimes about {c.recipeName} or its ingredients. Exactly 4 short options, exactly one correct, correctIndex is its 0-based position. One-sentence explanation.{_avoid(r.recent)}", 0.9, [])
    if a == "guess":
        pref = f", preferably one of: {', '.join(c.ingredients)}" if c.ingredients else ""
        return (f"Play \"Guess the Ingredient\" ({r.difficulty or 'medium'}). Choose ONE common ingredient{pref}. Write exactly 3 clues in first person (\"I am…\"), from vague to obvious. The clues must NOT contain the ingredient's name or any of its aliases. aliases: other common names, including Hindi names. emoji: one emoji for it.{_avoid(r.recent)}", 0.9, [])
    if a == "wyr":
        return (f"Ask ONE playful food-themed \"Would you rather\" question as two options (each under 10 words, no \"would you rather\" prefix). Make it fit someone who likes {c.cuisine or 'all kinds of'} food.{_avoid(r.recent)}", 1.0, [])
    if a == "wyr-react":
        q = r.question or {}
        return (f"The user was asked \"Would you rather: {clip(q.get('a'), 90)} OR {clip(q.get('b'), 90)}\" and picked \"{clip(r.picked, 90)}\". Give a playful 1-2 sentence reaction to their choice, and a short light follow-up question.", 1.0, [])
    if a == "jokes":
        return (f"Tell ONE short, clean, original-feeling cooking or food joke (setup + punchline), ideally playing on {c.recipeName} or its ingredients.{_avoid(r.recent)}", 1.0, [])
    if a == "riddles":
        return (f"Ask ONE short {r.difficulty or 'easy'} food riddle whose answer is a food or kitchen item. The riddle must not contain the answer. Include aliases (other names, Hindi names) and one helpful hint.{_avoid(r.recent)}", 0.9, [])
    if a == "chat":
        hist = [(m.who, clip(m.text, 500)) for m in r.messages[-12:] if m.text.strip()]
        return ("Reply naturally to the user's last message as a warm, funny friend — 1-3 sentences. Don't push games or quizzes; just chat. You may ask a light question back. If their message is a real question about the food they're cooking right now (doneness, salt, heat, what to do next), set cookingQuestion true, answer briefly and safely, and remind them to check the food themselves.", 0.9, hist)
    if a == "story":
        beat, mx = len(r.beats) + 1, story_max(r)
        so = "\n".join(f"Part {i + 1}: {clip(b.text, 600)}" + (f"\nThe user chose: {clip(b.choice, 80)}" if b.choice else "") for i, b in enumerate(r.beats))
        head = f"Continue this short interactive story.\n{so}\n" if r.beats else f"Start a short, original, funny interactive kitchen story about: {clip(r.prompt, 120) or 'an adventure involving ' + (', '.join(c.ingredients[:3]) or 'a curious vegetable')}."
        tail = "This part MUST bring the story to a clear, satisfying ending: set ending true and choices []." if beat >= mx else "End on a small decision: give exactly 2 short choices (under 8 words each), ending false."
        return (f"{head}\nThis part is {beat} of {mx}. Write 2-4 sentences (under 90 words). {tail} Keep the same title.", 1.0, [])
    if a == "song":
        some = f" and some of: {', '.join(c.ingredients[:6])}" if c.ingredients else ""
        return (f"Write a SHORT, ORIGINAL, funny {clip(r.style, 30) or 'kitchen jingle'} about: {clip(r.topic, 120) or c.recipeName}. Mention {c.recipeName}{some}. 4-8 short lines, simple rhymes, singable. Do not reuse any existing song's lyrics, tune references or structure, and don't name real artists.", 1.0, [])
    raise InvalidOutput(f"unknown activity {a}")


# ------------------------------------------------------------------ validation (mirrors lib/chill/engine.ts)

def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _s(v: Any, n: int) -> str:
    return clip(v, n) if isinstance(v, str) else ""


def _arr(v: Any) -> list[Any]:
    return v if isinstance(v, list) else []


def _lvl(v: Any) -> str:
    return v if v in ("easy", "medium", "hard") else "medium"


def _rid(p: str) -> str:
    return f"{p}-ai-{int(time.time() * 1000):x}{random.randrange(16 ** 4):04x}"


def valid_trivia(o: dict) -> dict | None:
    q, opts, ci = _s(o.get("question"), 220), [x for x in (_s(x, 80) for x in _arr(o.get("options"))) if x], o.get("correctIndex")
    if not q or len(opts) != 4 or len({norm(x) for x in opts}) != 4 or not isinstance(ci, int) or isinstance(ci, bool) or not 0 <= ci <= 3:
        return None
    order = list(range(4))
    random.shuffle(order)  # models favour some positions; shuffle so the answer isn't predictable
    return {"id": _rid("t"), "question": q, "options": [opts[i] for i in order], "correct": order.index(ci), "explanation": _s(o.get("explanation"), 240), "difficulty": _lvl(o.get("difficulty")), "topic": _s(o.get("topic"), 40) or None}


def valid_guess(o: dict) -> dict | None:
    ans = _s(o.get("answer"), 40)
    clues = [x for x in (_s(x, 160) for x in _arr(o.get("clues"))) if x][:4]
    if not ans or len(clues) < 3:
        return None
    keys = [w for w in norm(ans).split() if len(w) > 2]
    for c in clues:
        nc = norm(c)
        if any(k in nc.split() or re.sub(r"(es|s)$", "", k) in nc for k in keys):
            return None  # a clue gives the answer away
    aliases = list(dict.fromkeys([ans, *[x for x in (_s(a, 40) for a in _arr(o.get("aliases"))) if x]]))
    return {"id": _rid("g"), "answer": ans, "aliases": aliases, "clues": clues, "emoji": _s(o.get("emoji"), 8) or "🥄"}


def valid_wyr(o: dict) -> dict | None:
    a, b = _s(o.get("optionA"), 90), _s(o.get("optionB"), 90)
    if not a or not b or norm(a) == norm(b):
        return None
    return {"id": _rid("w"), "a": a, "b": b, "aEmoji": _s(o.get("emojiA"), 8) or None, "bEmoji": _s(o.get("emojiB"), 8) or None}


def valid_reaction(o: dict) -> dict | None:
    r = _s(o.get("reaction"), 260)
    return {"reaction": r, "followUp": _s(o.get("followUp"), 160)} if r else None


def valid_joke(o: dict) -> dict | None:
    s, p = _s(o.get("setup"), 180), _s(o.get("punchline"), 180)
    return {"id": _rid("j"), "setup": s, "punchline": p, "category": _s(o.get("category"), 30) or "kitchen"} if s and p else None


def valid_riddle(o: dict) -> dict | None:
    rd, ans = _s(o.get("riddle"), 260), _s(o.get("answer"), 40)
    if not rd or not ans or norm(ans) in norm(rd).split():
        return None
    aliases = list(dict.fromkeys([ans, *[x for x in (_s(a, 40) for a in _arr(o.get("aliases"))) if x]]))
    return {"id": _rid("r"), "riddle": rd, "answer": ans, "aliases": aliases, "hint": _s(o.get("hint"), 160) or "Think about what's in your kitchen.", "difficulty": _lvl(o.get("difficulty"))}


def valid_chat(o: dict) -> dict | None:
    r = _s(o.get("reply"), 600)
    return {"reply": r, "cookingQuestion": bool(o.get("cookingQuestion"))} if r else None


def valid_story(o: dict, must_end: bool) -> dict | None:
    text = _s(o.get("text"), 900)
    if not text:
        return None
    ending = must_end or bool(o.get("ending"))
    choices = [] if ending else [x for x in (_s(c, 70) for c in _arr(o.get("choices"))) if x][:2]
    if not ending and len(choices) < 2:
        return None
    return {"title": _s(o.get("title"), 70) or "A Kitchen Tale", "text": text, "choices": choices, "ending": ending}


def valid_song(o: dict) -> dict | None:
    lines = [x for x in (_s(l, 90) for l in _arr(o.get("lines"))) if x][:12]
    if len(lines) < 4:
        return None
    return {"title": _s(o.get("title"), 60) or "A Kitchen Song", "style": _s(o.get("style"), 30) or "jingle", "lines": lines}


def validate(r: ChillRequest, raw: dict) -> dict | None:
    a = r.activity
    if a == "story":
        return valid_story(raw, len(r.beats) + 1 >= story_max(r))
    return {"trivia": valid_trivia, "guess": valid_guess, "wyr": valid_wyr, "wyr-react": valid_reaction, "jokes": valid_joke,
            "riddles": valid_riddle, "chat": valid_chat, "song": valid_song}[a](raw)
