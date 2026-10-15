from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.models import SetLog, Workout, WorkoutExercise, WorkoutSession


def create(db: Session, workout: Workout) -> Workout:
    db.add(workout)
    db.commit()
    return get_detail(db, workout.id)  # recarrega com relacionamentos


def get(db: Session, workout_id: int) -> Workout | None:
    return db.get(Workout, workout_id)


def get_by_client_token(db: Session, token: str) -> Workout | None:
    w = db.execute(select(Workout).where(Workout.client_token == token)).scalar_one_or_none()
    return get_detail(db, w.id) if w else None


def get_detail(db: Session, workout_id: int) -> Workout | None:
    stmt = (
        select(Workout)
        .where(Workout.id == workout_id)
        .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.exercise))
    )
    return db.execute(stmt).scalar_one_or_none()


def list_all(db: Session, include_archived: bool = False) -> list[Workout]:
    stmt = select(Workout).order_by(Workout.created_at.desc())
    if not include_archived:
        stmt = stmt.where(Workout.archived.is_(False))
    return list(db.execute(stmt).scalars().all())


def replace_exercises(db: Session, workout: Workout, links: list[WorkoutExercise]) -> None:
    workout.exercises.clear()   # delete-orphan remove os antigos
    db.flush()
    for link in links:
        workout.exercises.append(link)
    db.commit()


def save(db: Session, obj: Workout) -> Workout:
    db.commit()
    db.refresh(obj)
    return obj


def delete_cascade(db: Session, obj: Workout) -> None:
    """Remove o treino, suas sessoes e as series dessas sessoes."""
    session_ids = select(WorkoutSession.id).where(WorkoutSession.workout_id == obj.id)
    db.execute(delete(SetLog).where(SetLog.session_id.in_(session_ids)))
    db.execute(delete(WorkoutSession).where(WorkoutSession.workout_id == obj.id))
    db.delete(obj)  # workout_exercise sai por cascade (relationship + FK)
    db.commit()
