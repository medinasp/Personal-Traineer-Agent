from sqlalchemy.orm import Session

from app.errors import ConflictError, NotFoundError
from app.models import Exercise, Workout, WorkoutExercise
from app.repositories import exercise as exercise_repo
from app.repositories import workout as repo
from app.schemas.workout import WorkoutCreate, WorkoutExerciseIn, WorkoutUpdate


def _build_links(db: Session, items: list[WorkoutExerciseIn]) -> list[WorkoutExercise]:
    seen: set[int] = set()
    links: list[WorkoutExercise] = []
    for idx, item in enumerate(items, start=1):
        if item.exercise_id in seen:
            raise ConflictError(f"Exercicio {item.exercise_id} repetido no treino")
        seen.add(item.exercise_id)
        ex: Exercise | None = exercise_repo.get(db, item.exercise_id)
        if ex is None:
            raise NotFoundError(f"Exercicio {item.exercise_id} nao encontrado")
        links.append(
            WorkoutExercise(
                exercise_id=item.exercise_id,
                position=item.position if item.position is not None else idx,
                target_sets=item.target_sets,
            )
        )
    return links


def create(db: Session, data: WorkoutCreate) -> Workout:
    if data.client_token:
        existing = repo.get_by_client_token(db, data.client_token)
        if existing is not None:
            return existing
    workout = Workout(name=data.name, notes=data.notes, client_token=data.client_token)
    workout.exercises = _build_links(db, data.exercises)
    return repo.create(db, workout)


def get_detail(db: Session, workout_id: int) -> Workout:
    obj = repo.get_detail(db, workout_id)
    if obj is None:
        raise NotFoundError(f"Treino {workout_id} nao encontrado")
    return obj


def list_all(db: Session, include_archived: bool = False) -> list[Workout]:
    return repo.list_all(db, include_archived)


def update(db: Session, workout_id: int, data: WorkoutUpdate) -> Workout:
    obj = repo.get(db, workout_id)
    if obj is None:
        raise NotFoundError(f"Treino {workout_id} nao encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    repo.save(db, obj)
    return get_detail(db, workout_id)


def set_exercises(db: Session, workout_id: int, items: list[WorkoutExerciseIn]) -> Workout:
    obj = repo.get(db, workout_id)
    if obj is None:
        raise NotFoundError(f"Treino {workout_id} nao encontrado")
    links = _build_links(db, items)
    repo.replace_exercises(db, obj, links)
    return get_detail(db, workout_id)


def archive(db: Session, workout_id: int) -> Workout:
    obj = repo.get(db, workout_id)
    if obj is None:
        raise NotFoundError(f"Treino {workout_id} nao encontrado")
    obj.archived = True
    repo.save(db, obj)
    return get_detail(db, workout_id)


def delete(db: Session, workout_id: int) -> None:
    obj = repo.get(db, workout_id)
    if obj is None:
        raise NotFoundError(f"Treino {workout_id} nao encontrado")
    repo.delete_cascade(db, obj)
