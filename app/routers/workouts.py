from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.workout import (
    WorkoutCreate,
    WorkoutDetail,
    WorkoutExerciseIn,
    WorkoutRead,
    WorkoutUpdate,
)
from app.services import workout as service

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutDetail, status_code=status.HTTP_201_CREATED)
def create(data: WorkoutCreate, db: Session = Depends(get_db)) -> WorkoutDetail:
    return service.create(db, data)


@router.get("", response_model=list[WorkoutRead])
def list_all(include_archived: bool = False, db: Session = Depends(get_db)) -> list[WorkoutRead]:
    return service.list_all(db, include_archived)


@router.get("/{workout_id}", response_model=WorkoutDetail)
def get(workout_id: int, db: Session = Depends(get_db)) -> WorkoutDetail:
    return service.get_detail(db, workout_id)


@router.patch("/{workout_id}", response_model=WorkoutDetail)
def update(workout_id: int, data: WorkoutUpdate, db: Session = Depends(get_db)) -> WorkoutDetail:
    return service.update(db, workout_id, data)


@router.put("/{workout_id}/exercises", response_model=WorkoutDetail)
def set_exercises(
    workout_id: int, items: list[WorkoutExerciseIn], db: Session = Depends(get_db)
) -> WorkoutDetail:
    return service.set_exercises(db, workout_id, items)


@router.post("/{workout_id}/archive", response_model=WorkoutDetail)
def archive(workout_id: int, db: Session = Depends(get_db)) -> WorkoutDetail:
    return service.archive(db, workout_id)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(workout_id: int, db: Session = Depends(get_db)) -> None:
    service.delete(db, workout_id)
