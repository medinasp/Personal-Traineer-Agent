from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Exercise(Base):
    """Catalogo de exercicios. Cadastro livre."""

    __tablename__ = "exercise"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    muscle_group: Mapped[str | None] = mapped_column(String(60))
    equipment: Mapped[str | None] = mapped_column(String(60))
    icon: Mapped[str | None] = mapped_column(String(40))  # nome do glifo escolhido; null = automatico
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    client_token: Mapped[str | None] = mapped_column(String(64), unique=True)  # criacao idempotente (offline)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    workout_links: Mapped[list["WorkoutExercise"]] = relationship(back_populates="exercise")
    set_logs: Mapped[list["SetLog"]] = relationship(back_populates="exercise")


class Workout(Base):
    """Treino montado (molde reutilizavel)."""

    __tablename__ = "workout"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    client_token: Mapped[str | None] = mapped_column(String(64), unique=True)  # criacao idempotente (offline)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="WorkoutExercise.position",
    )
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="workout")


class WorkoutExercise(Base):
    """Juncao: quais exercicios no treino, em ordem."""

    __tablename__ = "workout_exercise"
    __table_args__ = (UniqueConstraint("workout_id", "exercise_id", name="uq_workout_exercise"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workout_id: Mapped[int] = mapped_column(
        ForeignKey("workout.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercise.id", ondelete="RESTRICT"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    target_sets: Mapped[int] = mapped_column(Integer, nullable=False, default=6)

    workout: Mapped["Workout"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship(back_populates="workout_links")


class WorkoutSession(Base):
    """Execucao de um dia: uma vez que o treino foi feito. Onde o historico vive."""

    __tablename__ = "workout_session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workout_id: Mapped[int] = mapped_column(
        ForeignKey("workout.id", ondelete="RESTRICT"), nullable=False
    )
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    notes: Mapped[str | None] = mapped_column(Text)
    # token gerado pelo cliente (offline) p/ criacao idempotente; null = criada online sem token
    client_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    workout: Mapped["Workout"] = relationship(back_populates="sessions")
    set_logs: Mapped[list["SetLog"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class SetLog(Base):
    """Serie realizada (o dado que importa). reps/weight nulos ate preencher."""

    __tablename__ = "set_log"
    __table_args__ = (
        UniqueConstraint("session_id", "exercise_id", "set_number", name="uq_set_log"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("workout_session.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[int] = mapped_column(
        ForeignKey("exercise.id", ondelete="RESTRICT"), nullable=False
    )
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int | None] = mapped_column(Integer)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session: Mapped["WorkoutSession"] = relationship(back_populates="set_logs")
    exercise: Mapped["Exercise"] = relationship(back_populates="set_logs")


class ChatConversation(Base):
    """Uma conversa com o agente Coach (app pessoal: normalmente uma so)."""

    __tablename__ = "chat_conversation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.id",
    )


class ChatMessage(Base):
    """Mensagem da conversa. role: system|user|assistant|tool."""

    __tablename__ = "chat_message"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("chat_conversation.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    # tool-calling: chamadas do assistant (JSON) e id/nome quando role=tool
    tool_calls: Mapped[str | None] = mapped_column(Text)
    tool_call_id: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    conversation: Mapped["ChatConversation"] = relationship(back_populates="messages")


class KbChunk(Base):
    """Trecho da base de conhecimento (RAG). Embedding guardado como JSON (lista de floats)."""

    __tablename__ = "kb_chunk"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # curated|pubmed|semanticscholar
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)  # dedup (ex: PMID)
    title: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int | None] = mapped_column(Integer)
    topic: Mapped[str | None] = mapped_column(String(40))  # hipertrofia|emagrecimento|nutricao
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[str] = mapped_column(Text, nullable=False)  # JSON: list[float]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class UserProfile(Base):
    """Perfil (singleton): dados mais estaveis do usuario."""

    __tablename__ = "user_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    height_cm: Mapped[int | None] = mapped_column(Integer)
    sex: Mapped[str | None] = mapped_column(String(10))  # masculino|feminino|outro
    birth_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    goals: Mapped[str | None] = mapped_column(Text)        # metas
    objectives: Mapped[str | None] = mapped_column(Text)   # objetivos / foco
    notes: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class BodyMeasurement(Base):
    """Medida corporal num dia (bioimpedancia etc.). Serie temporal p/ analise."""

    __tablename__ = "body_measurement"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    measured_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    body_fat_pct: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    muscle_mass_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    visceral_fat: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    body_water_pct: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    bmr_kcal: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
