from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.errors import register_error_handlers
from app.routers import chat, exercises, profile, sessions, workouts
from app.security import require_token

API_V1 = "/api/v1"

app = FastAPI(title="Fitness App API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,      # sem cookies; auth futura via header
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)
_auth = [Depends(require_token)]
app.include_router(exercises.router, prefix=API_V1, dependencies=_auth)
app.include_router(workouts.router, prefix=API_V1, dependencies=_auth)
app.include_router(sessions.router, prefix=API_V1, dependencies=_auth)
app.include_router(profile.router, prefix=API_V1, dependencies=_auth)
app.include_router(chat.router, prefix=API_V1, dependencies=_auth)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"app": "fitness-app", "version": "0.1.0"}
