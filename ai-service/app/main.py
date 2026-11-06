"""
RANNAMATE AI service — internal FastAPI app called only by the NestJS backend.

  GET  /health                 public, no secrets
  POST /v1/mate/chat           Cooking Mate answer for the current recipe/step
  POST /v1/chill/activity      one validated Cook & Chill item
  POST /v1/vision/ingredients  ingredient labels + confidences from a photo

Every /v1 route requires X-Internal-Key. There is no database access here.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .api.routes import internal, public
from .core.errors import InvalidOutput, ProviderError, ProviderNotConfigured

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app() -> FastAPI:
    app = FastAPI(title="RANNAMATE AI service", version="0.1.0", docs_url="/docs", redoc_url=None)
    app.include_router(public)
    app.include_router(internal)

    def fail(status: int, code: str, message: str) -> JSONResponse:
        return JSONResponse(status_code=status, content={"detail": {"code": code, "message": message}})

    @app.exception_handler(ProviderNotConfigured)
    async def _not_configured(_r: Request, _e: ProviderNotConfigured):
        return fail(503, "AI_PROVIDER_NOT_CONFIGURED", "No AI model key is configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY).")

    @app.exception_handler(ProviderError)
    async def _provider(_r: Request, e: ProviderError):
        logging.getLogger("ai").warning("provider error: %s", e)
        return fail(502, "AI_PROVIDER_ERROR", "The AI model did not answer.")

    @app.exception_handler(InvalidOutput)
    async def _invalid(_r: Request, _e: InvalidOutput):
        return fail(422, "AI_INVALID_OUTPUT", "The model's answer did not pass validation.")

    @app.exception_handler(RequestValidationError)
    async def _validation(_r: Request, e: RequestValidationError):
        return JSONResponse(status_code=400, content={"detail": {"code": "VALIDATION_FAILED", "message": "Invalid request.", "errors": [{"loc": x.get("loc"), "msg": x.get("msg")} for x in e.errors()][:10]}})

    return app


app = create_app()
