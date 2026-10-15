"""Seed idempotente: insere exercicios principais se o catalogo estiver vazio.

Rodado uma vez no boot do container (ver entrypoint.sh). Nao sobrescreve nada.
"""
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Exercise

COMMON_EXERCISES: list[tuple[str, str]] = [
    # Peito
    ("Supino reto", "Peito"),
    ("Supino inclinado", "Peito"),
    ("Crucifixo", "Peito"),
    ("Crossover", "Peito"),
    # Costas
    ("Puxador frente", "Costas"),
    ("Remada curvada", "Costas"),
    ("Remada baixa", "Costas"),
    ("Barra fixa", "Costas"),
    ("Levantamento terra", "Costas"),
    # Ombro
    ("Desenvolvimento", "Ombro"),
    ("Elevacao lateral", "Ombro"),
    ("Elevacao frontal", "Ombro"),
    # Biceps
    ("Rosca direta", "Biceps"),
    ("Rosca alternada", "Biceps"),
    ("Rosca martelo", "Biceps"),
    # Triceps
    ("Triceps corda", "Triceps"),
    ("Triceps testa", "Triceps"),
    ("Triceps frances", "Triceps"),
    # Pernas
    ("Agachamento", "Pernas"),
    ("Leg press", "Pernas"),
    ("Cadeira extensora", "Pernas"),
    ("Mesa flexora", "Pernas"),
    ("Panturrilha", "Pernas"),
    ("Afundo", "Pernas"),
    # Core
    ("Abdominal", "Abdomen"),
    ("Prancha", "Abdomen"),
]


def seed_exercises() -> None:
    with SessionLocal() as db:
        exists = db.execute(select(Exercise.id).limit(1)).first()
        if exists is not None:
            print("seed: catalogo ja tem exercicios, nada a fazer")
            return
        for name, muscle_group in COMMON_EXERCISES:
            db.add(Exercise(name=name, muscle_group=muscle_group))
        db.commit()
        print(f"seed: {len(COMMON_EXERCISES)} exercicios inseridos")


if __name__ == "__main__":
    seed_exercises()
