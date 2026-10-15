from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.profile import (
    MeasurementCreate,
    MeasurementRead,
    ProfileRead,
    ProfileUpdate,
)
from app.services import profile as service

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileRead)
def get_profile(db: Session = Depends(get_db)) -> ProfileRead:
    return service.get_or_create_profile(db)


@router.put("/profile", response_model=ProfileRead)
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)) -> ProfileRead:
    return service.update_profile(db, data)


@router.get("/measurements", response_model=list[MeasurementRead])
def list_measurements(limit: int = 50, db: Session = Depends(get_db)) -> list[MeasurementRead]:
    return service.list_measurements(db, limit)


@router.post("/measurements", response_model=MeasurementRead, status_code=status.HTTP_201_CREATED)
def create_measurement(data: MeasurementCreate, db: Session = Depends(get_db)) -> MeasurementRead:
    return service.create_measurement(db, data)


@router.delete("/measurements/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_measurement(measurement_id: int, db: Session = Depends(get_db)) -> None:
    service.delete_measurement(db, measurement_id)
