from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.exercise import ExerciseRead


class WorkoutExerciseIn(BaseModel):
    exercise_id: int
    position: int | None = None          # se None, usa a ordem da lista
    target_sets: int = Field(default=6, ge=1, le=20)


class WorkoutCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    notes: str | None = None
    exercises: list[WorkoutExerciseIn] = Field(default_factory=list)
    client_token: str | None = Field(default=None, max_length=64)


class WorkoutUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = None
    archived: bool | None = None


class WorkoutExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    position: int
    target_sets: int
    exercise: ExerciseRead


class WorkoutRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    notes: str | None
    archived: bool
    created_at: datetime


class WorkoutDetail(WorkoutRead):
    exercises: list[WorkoutExerciseRead]
