from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.session import (
    LastResponse,
    SessionCreate,
    SessionDetail,
    SessionRead,
    SetLogRead,
    SetsSave,
)
from app.services import session as service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create(data: SessionCreate, db: Session = Depends(get_db)) -> SessionRead:
    return service.create(db, data)


@router.get("", response_model=list[SessionRead])
def list_all(workout_id: int | None = None, db: Session = Depends(get_db)) -> list[SessionRead]:
    return service.list_all(db, workout_id)


@router.get("/{session_id}", response_model=SessionDetail)
def get(session_id: int, db: Session = Depends(get_db)) -> SessionDetail:
    return service.get_detail(db, session_id)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(session_id: int, db: Session = Depends(get_db)) -> None:
    service.delete(db, session_id)


@router.put(
    "/{session_id}/exercises/{exercise_id}/sets",
    response_model=list[SetLogRead],
)
def save_sets(
    session_id: int, exercise_id: int, body: SetsSave, db: Session = Depends(get_db)
) -> list[SetLogRead]:
    return service.save_sets(db, session_id, exercise_id, body.sets)


@router.get(
    "/{session_id}/exercises/{exercise_id}/last",
    response_model=LastResponse,
)
def last_sets(session_id: int, exercise_id: int, db: Session = Depends(get_db)) -> LastResponse:
    """Data + series da ultima vez que este exercicio foi feito neste treino."""
    session, sets = service.get_last(db, session_id, exercise_id)
    return LastResponse(
        performed_at=session.performed_at if session else None,
        sets=sets,
    )
