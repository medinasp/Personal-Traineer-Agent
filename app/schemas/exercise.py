from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    muscle_group: str | None = Field(default=None, max_length=60)
    equipment: str | None = Field(default=None, max_length=60)
    icon: str | None = Field(default=None, max_length=40)
    client_token: str | None = Field(default=None, max_length=64)


class ExerciseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    muscle_group: str | None = Field(default=None, max_length=60)
    equipment: str | None = Field(default=None, max_length=60)
    icon: str | None = Field(default=None, max_length=40)


class ExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    muscle_group: str | None
    equipment: str | None
    icon: str | None
    archived: bool
    created_at: datetime
