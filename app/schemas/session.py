from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    workout_id: int
    performed_at: datetime | None = None   # default = agora (no banco)
    notes: str | None = None
    client_token: str | None = Field(default=None, max_length=64)


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workout_id: int
    performed_at: datetime
    notes: str | None
    client_token: str | None
    created_at: datetime


class SetLogIn(BaseModel):
    set_number: int = Field(ge=1)
    reps: int | None = Field(default=None, ge=0)
    weight_kg: float | None = Field(default=None, ge=0)


class SetLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    set_number: int
    reps: int | None
    weight_kg: float | None


class SetsSave(BaseModel):
    """Salva (substitui) todas as series de um exercicio na sessao."""

    sets: list[SetLogIn]


class SessionDetail(SessionRead):
    set_logs: list[SetLogRead]


class LastSet(BaseModel):
    """Uma serie da ultima vez que o exercicio foi feito neste treino."""

    model_config = ConfigDict(from_attributes=True)

    set_number: int
    reps: int | None
    weight_kg: float | None


class LastResponse(BaseModel):
    """Ultima vez: data da sessao anterior + suas series (vazio se nao houver)."""

    performed_at: datetime | None
    sets: list[LastSet]


class HistorySession(BaseModel):
    """Uma sessao no historico de um exercicio."""

    session_id: int
    workout_id: int
    performed_at: datetime
    sets: list[LastSet]
