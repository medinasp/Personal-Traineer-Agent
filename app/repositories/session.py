from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.models import SetLog, WorkoutSession


def create(db: Session, session: WorkoutSession) -> WorkoutSession:
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get(db: Session, session_id: int) -> WorkoutSession | None:
    return db.get(WorkoutSession, session_id)


def get_by_client_token(db: Session, token: str) -> WorkoutSession | None:
    stmt = select(WorkoutSession).where(WorkoutSession.client_token == token)
    return db.execute(stmt).scalar_one_or_none()


def get_detail(db: Session, session_id: int) -> WorkoutSession | None:
    stmt = (
        select(WorkoutSession)
        .where(WorkoutSession.id == session_id)
        .options(selectinload(WorkoutSession.set_logs))
    )
    return db.execute(stmt).scalar_one_or_none()


def list_all(db: Session, workout_id: int | None = None) -> list[WorkoutSession]:
    stmt = select(WorkoutSession).order_by(WorkoutSession.performed_at.desc())
    if workout_id is not None:
        stmt = stmt.where(WorkoutSession.workout_id == workout_id)
    return list(db.execute(stmt).scalars().all())


def delete_session(db: Session, session: WorkoutSession) -> None:
    db.delete(session)   # cascade apaga os set_log
    db.commit()


def replace_sets(
    db: Session, session_id: int, exercise_id: int, rows: list[SetLog]
) -> list[SetLog]:
    """Substitui todas as series de um exercicio nesta sessao."""
    db.execute(
        delete(SetLog).where(
            SetLog.session_id == session_id, SetLog.exercise_id == exercise_id
        )
    )
    for row in rows:
        db.add(row)
    db.commit()
    stmt = (
        select(SetLog)
        .where(SetLog.session_id == session_id, SetLog.exercise_id == exercise_id)
        .order_by(SetLog.set_number)
    )
    return list(db.execute(stmt).scalars().all())


def get_last(
    db: Session, workout_id: int, exercise_id: int, current_session_id: int
) -> tuple[WorkoutSession | None, list[SetLog]]:
    """Sessao ANTERIOR deste exercicio neste treino + suas series.

    Retorna (session, sets). session e' None se nao houver historico.
    """
    prev = (
        select(WorkoutSession)
        .join(SetLog, SetLog.session_id == WorkoutSession.id)
        .where(
            WorkoutSession.workout_id == workout_id,
            SetLog.exercise_id == exercise_id,
            WorkoutSession.id != current_session_id,
        )
        .order_by(WorkoutSession.performed_at.desc())
        .limit(1)
    )
    session = db.execute(prev).scalars().first()
    if session is None:
        return None, []
    sets = _sets_of(db, session.id, exercise_id)
    return session, sets


def _sets_of(db: Session, session_id: int, exercise_id: int) -> list[SetLog]:
    stmt = (
        select(SetLog)
        .where(SetLog.session_id == session_id, SetLog.exercise_id == exercise_id)
        .order_by(SetLog.set_number)
    )
    return list(db.execute(stmt).scalars().all())


def get_exercise_history(
    db: Session,
    exercise_id: int,
    limit: int,
    offset: int,
    start: datetime | None,
    end: datetime | None,
) -> list[tuple[WorkoutSession, list[SetLog]]]:
    """Sessoes (mais recentes primeiro) em que o exercicio foi feito, paginado."""
    stmt = (
        select(WorkoutSession)
        .join(SetLog, SetLog.session_id == WorkoutSession.id)
        .where(SetLog.exercise_id == exercise_id)
    )
    if start is not None:
        stmt = stmt.where(WorkoutSession.performed_at >= start)
    if end is not None:
        stmt = stmt.where(WorkoutSession.performed_at <= end)
    stmt = (
        stmt.distinct()
        .order_by(WorkoutSession.performed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = list(db.execute(stmt).scalars().all())
    return [(s, _sets_of(db, s.id, exercise_id)) for s in sessions]
