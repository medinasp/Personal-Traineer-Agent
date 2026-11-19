from datetime import datetime

from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError
from app.models import SetLog, WorkoutSession
from app.repositories import exercise as exercise_repo
from app.repositories import session as repo
from app.repositories import workout as workout_repo
from app.schemas.session import SessionCreate, SetLogIn


def create(db: Session, data: SessionCreate) -> WorkoutSession:
    # idempotente: se ja existe sessao com este client_token, devolve a existente
    if data.client_token:
        existing = repo.get_by_client_token(db, data.client_token)
        if existing is not None:
            return existing
    if workout_repo.get(db, data.workout_id) is None:
        raise NotFoundError(f"Treino {data.workout_id} nao encontrado")
    session = WorkoutSession(
        workout_id=data.workout_id,
        notes=data.notes,
        client_token=data.client_token,
    )
    if data.performed_at is not None:
        session.performed_at = data.performed_at
    return repo.create(db, session)


def get_detail(db: Session, session_id: int) -> WorkoutSession:
    obj = repo.get_detail(db, session_id)
    if obj is None:
        raise NotFoundError(f"Sessao {session_id} nao encontrada")
    return obj


def list_all(db: Session, workout_id: int | None = None) -> list[WorkoutSession]:
    return repo.list_all(db, workout_id)


def delete(db: Session, session_id: int) -> None:
    obj = repo.get(db, session_id)
    if obj is None:
        raise NotFoundError(f"Sessao {session_id} nao encontrada")
    repo.delete_session(db, obj)


def _require_session(db: Session, session_id: int) -> WorkoutSession:
    obj = repo.get(db, session_id)
    if obj is None:
        raise NotFoundError(f"Sessao {session_id} nao encontrada")
    return obj


def update_notes(db: Session, session_id: int, notes: str | None) -> WorkoutSession:
    obj = _require_session(db, session_id)
    obj.notes = notes
    db.commit()
    db.refresh(obj)
    return obj


def save_sets(
    db: Session, session_id: int, exercise_id: int, sets: list[SetLogIn]
) -> list[SetLog]:
    _require_session(db, session_id)
    if exercise_repo.get(db, exercise_id) is None:
        raise NotFoundError(f"Exercicio {exercise_id} nao encontrado")

    numbers = [s.set_number for s in sets]
    if len(numbers) != len(set(numbers)):
        raise ConflictError("set_number repetido")

    rows = [
        SetLog(
            session_id=session_id,
            exercise_id=exercise_id,
            set_number=s.set_number,
            reps=s.reps,
            weight_kg=s.weight_kg,
        )
        for s in sets
    ]
    return repo.replace_sets(db, session_id, exercise_id, rows)


def get_last(
    db: Session, session_id: int, exercise_id: int
) -> tuple[WorkoutSession | None, list[SetLog]]:
    """Ultima vez que o exercicio foi feito no treino desta sessao (exclui a atual)."""
    session = _require_session(db, session_id)
    return repo.get_last(db, session.workout_id, exercise_id, session_id)


def get_exercise_history(
    db: Session,
    exercise_id: int,
    limit: int,
    offset: int,
    start: datetime | None,
    end: datetime | None,
) -> list[tuple[WorkoutSession, list[SetLog]]]:
    if exercise_repo.get(db, exercise_id) is None:
        raise NotFoundError(f"Exercicio {exercise_id} nao encontrado")
    return repo.get_exercise_history(db, exercise_id, limit, offset, start, end)
