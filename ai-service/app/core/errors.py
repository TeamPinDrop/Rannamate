from fastapi import HTTPException


def err(status: int, code: str, message: str) -> HTTPException:
    """Errors carry a stable code the backend maps to its own API errors."""
    return HTTPException(status_code=status, detail={"code": code, "message": message})


class ProviderNotConfigured(Exception):
    pass


class ProviderError(Exception):
    pass


class InvalidOutput(Exception):
    pass
