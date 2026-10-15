from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.models import Exercise
from app.repositories import exercise as repo
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate


def create(db: Session, data: ExerciseCreate) -> Exercise:
    if data.client_token:
        existing = repo.get_by_client_token(db, data.client_token)
        if existing is not None:
            return existing
    return repo.create(db, **data.model_dump())


def get(db: Session, exercise_id: int) -> Exercise:
    obj = repo.get(db, exercise_id)
    if obj is None:
        raise NotFoundError(f"Exercicio {exercise_id} nao encontrado")
    return obj


def list_all(
    db: Session, include_archived: bool = False, with_history: bool = False
) -> list[Exercise]:
    return repo.list_all(db, include_archived, with_history)


def update(db: Session, exercise_id: int, data: ExerciseUpdate) -> Exercise:
    obj = get(db, exercise_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    return repo.save(db, obj)


def archive(db: Session, exercise_id: int) -> Exercise:
    obj = get(db, exercise_id)
    obj.archived = True
    return repo.save(db, obj)


def delete(db: Session, exercise_id: int) -> None:
    obj = get(db, exercise_id)
    repo.delete_cascade(db, obj)
