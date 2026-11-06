import hmac

from fastapi import Depends, Header

from .config import Settings, get_settings
from .errors import err


def require_internal_key(x_internal_key: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> None:
    """Only the NestJS backend may call this service. It sends the shared key in X-Internal-Key."""
    if not settings.service_key:
        raise err(503, "SERVICE_KEY_NOT_CONFIGURED", "AI_SERVICE_API_KEY is not set on the AI service.")
    if not x_internal_key or not hmac.compare_digest(x_internal_key, settings.service_key):
        raise err(401, "INVALID_SERVICE_KEY", "Missing or invalid internal service key.")
