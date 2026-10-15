from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.exercise import ExerciseCreate, ExerciseRead, ExerciseUpdate
from app.schemas.session import HistorySession, LastSet
from app.services import exercise as service
from app.services import session as session_service

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.post("", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
def create(data: ExerciseCreate, db: Session = Depends(get_db)) -> ExerciseRead:
    return service.create(db, data)


@router.get("", response_model=list[ExerciseRead])
def list_all(
    include_archived: bool = False,
    with_history: bool = False,
    db: Session = Depends(get_db),
) -> list[ExerciseRead]:
    return service.list_all(db, include_archived, with_history)


@router.get("/{exercise_id}", response_model=ExerciseRead)
def get(exercise_id: int, db: Session = Depends(get_db)) -> ExerciseRead:
    return service.get(db, exercise_id)


@router.patch("/{exercise_id}", response_model=ExerciseRead)
def update(exercise_id: int, data: ExerciseUpdate, db: Session = Depends(get_db)) -> ExerciseRead:
    return service.update(db, exercise_id, data)


@router.post("/{exercise_id}/archive", response_model=ExerciseRead)
def archive(exercise_id: int, db: Session = Depends(get_db)) -> ExerciseRead:
    return service.archive(db, exercise_id)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(exercise_id: int, db: Session = Depends(get_db)) -> None:
    service.delete(db, exercise_id)


@router.get("/{exercise_id}/history", response_model=list[HistorySession])
def history(
    exercise_id: int,
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    start: datetime | None = Query(None, description="filtro: performed_at >= start"),
    end: datetime | None = Query(None, description="filtro: performed_at <= end"),
    db: Session = Depends(get_db),
) -> list[HistorySession]:
    """Historico do exercicio: sessoes (recentes primeiro), paginado por limit/offset."""
    rows = session_service.get_exercise_history(db, exercise_id, limit, offset, start, end)
    return [
        HistorySession(
            session_id=s.id,
            workout_id=s.workout_id,
            performed_at=s.performed_at,
            sets=[LastSet.model_validate(x) for x in sets],
        )
        for s, sets in rows
    ]
