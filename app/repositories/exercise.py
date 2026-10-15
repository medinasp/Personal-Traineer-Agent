from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Exercise, SetLog, WorkoutExercise


def create(db: Session, **data) -> Exercise:
    obj = Exercise(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get(db: Session, exercise_id: int) -> Exercise | None:
    return db.get(Exercise, exercise_id)


def get_by_client_token(db: Session, token: str) -> Exercise | None:
    return db.execute(select(Exercise).where(Exercise.client_token == token)).scalar_one_or_none()


def list_all(
    db: Session, include_archived: bool = False, with_history: bool = False
) -> list[Exercise]:
    stmt = select(Exercise).order_by(Exercise.name)
    if not include_archived:
        stmt = stmt.where(Exercise.archived.is_(False))
    if with_history:
        # apenas exercicios que ja tem alguma serie registrada
        stmt = stmt.where(Exercise.id.in_(select(SetLog.exercise_id)))
    return list(db.execute(stmt).scalars().all())


def save(db: Session, obj: Exercise) -> Exercise:
    db.commit()
    db.refresh(obj)
    return obj


def delete_cascade(db: Session, obj: Exercise) -> None:
    """Remove o exercicio e tudo que depende dele (series e vinculos em treinos)."""
    db.execute(delete(SetLog).where(SetLog.exercise_id == obj.id))
    db.execute(delete(WorkoutExercise).where(WorkoutExercise.exercise_id == obj.id))
    db.delete(obj)
    db.commit()
