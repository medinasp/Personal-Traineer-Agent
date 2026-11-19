from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdate(BaseModel):
    height_cm: int | None = Field(default=None, ge=50, le=260)
    sex: str | None = Field(default=None, max_length=10)
    birth_date: datetime | None = None
    goals: str | None = None
    objectives: str | None = None
    notes: str | None = None


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    height_cm: int | None
    sex: str | None
    birth_date: datetime | None
    goals: str | None
    objectives: str | None
    notes: str | None
    updated_at: datetime


class MeasurementCreate(BaseModel):
    measured_on: datetime | None = None
    weight_kg: float | None = Field(default=None, ge=0)
    body_fat_pct: float | None = Field(default=None, ge=0, le=100)
    muscle_mass_kg: float | None = Field(default=None, ge=0)
    visceral_fat: float | None = Field(default=None, ge=0)
    body_water_pct: float | None = Field(default=None, ge=0, le=100)
    bmr_kcal: int | None = Field(default=None, ge=0)
    notes: str | None = None
    client_token: str | None = Field(default=None, max_length=64)


class MeasurementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    measured_on: datetime
    weight_kg: float | None
    body_fat_pct: float | None
    muscle_mass_kg: float | None
    visceral_fat: float | None
    body_water_pct: float | None
    bmr_kcal: int | None
    notes: str | None
