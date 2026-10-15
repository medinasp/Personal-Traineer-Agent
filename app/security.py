import hmac

from fastapi import Header, HTTPException, status

from app.config import settings


async def require_token(authorization: str | None = Header(default=None)) -> None:
    """Exige `Authorization: Bearer <API_TOKEN>` quando API_TOKEN estiver definido.

    Em dev local (API_TOKEN vazio) a checagem fica desligada.
    """
    token = settings.api_token.strip()
    if not token:
        return  # auth desligada
    expected = f"Bearer {token}"
    # compare_digest = comparacao em tempo constante (evita timing attack)
    if authorization is None or not hmac.compare_digest(authorization, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido ou ausente",
        )
