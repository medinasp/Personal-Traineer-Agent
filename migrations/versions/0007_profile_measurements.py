"""user_profile + body_measurement (dados pessoais)

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profile",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("height_cm", sa.Integer(), nullable=True),
        sa.Column("sex", sa.String(length=10), nullable=True),
        sa.Column("birth_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("goals", sa.Text(), nullable=True),
        sa.Column("objectives", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "body_measurement",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("measured_on", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column("body_fat_pct", sa.Numeric(4, 1), nullable=True),
        sa.Column("muscle_mass_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column("visceral_fat", sa.Numeric(4, 1), nullable=True),
        sa.Column("body_water_pct", sa.Numeric(4, 1), nullable=True),
        sa.Column("bmr_kcal", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_body_measurement_date", "body_measurement", ["measured_on"])


def downgrade() -> None:
    op.drop_index("ix_body_measurement_date", table_name="body_measurement")
    op.drop_table("body_measurement")
    op.drop_table("user_profile")
