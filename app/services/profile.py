from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.models import BodyMeasurement, UserProfile
from app.schemas.profile import MeasurementCreate, ProfileUpdate


def get_or_create_profile(db: Session) -> UserProfile:
    obj = db.execute(select(UserProfile).order_by(UserProfile.id).limit(1)).scalar_one_or_none()
    if obj is None:
        obj = UserProfile()
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


def update_profile(db: Session, data: ProfileUpdate) -> UserProfile:
    obj = get_or_create_profile(db)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


def list_measurements(db: Session, limit: int = 50) -> list[BodyMeasurement]:
    stmt = select(BodyMeasurement).order_by(BodyMeasurement.measured_on.desc()).limit(limit)
    return list(db.execute(stmt).scalars().all())


def create_measurement(db: Session, data: MeasurementCreate) -> BodyMeasurement:
    if data.client_token:
        existing = db.execute(
            select(BodyMeasurement).where(BodyMeasurement.client_token == data.client_token)
        ).scalar_one_or_none()
        if existing is not None:
            return existing
    payload = data.model_dump(exclude_unset=True)
    obj = BodyMeasurement(**payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete_measurement(db: Session, measurement_id: int) -> None:
    obj = db.get(BodyMeasurement, measurement_id)
    if obj is None:
        raise NotFoundError(f"Medida {measurement_id} nao encontrada")
    db.delete(obj)
    db.commit()
