from typing import Literal

from pydantic import BaseModel, Field


class Turn(BaseModel):
    who: Literal["user", "mate"]
    text: str = Field(max_length=1000)


class RecipeStep(BaseModel):
    text: str = Field(max_length=600)
    timerSeconds: int | None = None
    tip: str | None = Field(default=None, max_length=300)


class RecipeContext(BaseModel):
    name: str = Field(max_length=120)
    servings: int | None = None
    cuisine: str | None = None
    ingredients: list[str] = Field(default_factory=list, max_length=40)
    steps: list[RecipeStep] = Field(default_factory=list, max_length=30)
    substitutions: list[str] = Field(default_factory=list, max_length=30)


class MateRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    history: list[Turn] = Field(default_factory=list, max_length=12)
    recipe: RecipeContext | None = None
    stepIndex: int | None = Field(default=None, ge=0)
    persona: Literal["mild", "masala", "chatpata"] = "masala"
    lang: Literal["en", "hinglish"] = "en"
    allergies: list[str] = Field(default_factory=list, max_length=10)
    diets: list[str] = Field(default_factory=list, max_length=10)


class MateReply(BaseModel):
    reply: str
    action: Literal["next", "prev", "repeat", "start-timer", "pause-timer"] | None = None
    goToStep: int | None = None
    timerSeconds: int | None = None
    swap: dict | None = None
    model: str | None = None


class Detection(BaseModel):
    label: str
    confidence: float


class VisionReply(BaseModel):
    detections: list[Detection]
    model: str | None = None
