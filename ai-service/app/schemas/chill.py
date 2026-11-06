from typing import Literal

from pydantic import BaseModel, Field

Activity = Literal["trivia", "guess", "wyr", "wyr-react", "jokes", "riddles", "chat", "story", "song"]


class ChillContext(BaseModel):
    recipeName: str = Field(max_length=120)
    cuisine: str = Field(default="", max_length=40)
    stepText: str = Field(default="", max_length=600)
    nextStepText: str | None = Field(default=None, max_length=600)
    remainingSec: int = Field(ge=0, le=7200)
    ingredients: list[str] = Field(default_factory=list, max_length=30)
    pantry: list[str] = Field(default_factory=list, max_length=60)
    persona: Literal["mild", "masala", "chatpata"] = "masala"
    lang: Literal["en", "hinglish"] = "en"
    allergies: list[str] = Field(default_factory=list, max_length=10)


class ChatLine(BaseModel):
    who: Literal["user", "mate"]
    text: str = Field(max_length=600)


class Beat(BaseModel):
    text: str = Field(max_length=1000)
    choice: str | None = Field(default=None, max_length=120)


class ChillRequest(BaseModel):
    activity: Activity
    ctx: ChillContext
    difficulty: Literal["easy", "medium", "hard"] | None = None
    recent: list[str] = Field(default_factory=list, max_length=20)
    messages: list[ChatLine] = Field(default_factory=list, max_length=24)
    question: dict[str, str] | None = None
    picked: str | None = Field(default=None, max_length=90)
    prompt: str | None = Field(default=None, max_length=120)
    beats: list[Beat] = Field(default_factory=list, max_length=4)
    maxBeats: int | None = Field(default=None, ge=2, le=4)
    topic: str | None = Field(default=None, max_length=120)
    style: str | None = Field(default=None, max_length=30)
