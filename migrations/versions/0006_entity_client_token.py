"""client_token em exercise e workout (criacao idempotente offline)

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("exercise", sa.Column("client_token", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_exercise_client_token", "exercise", ["client_token"])
    op.add_column("workout", sa.Column("client_token", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_workout_client_token", "workout", ["client_token"])


def downgrade() -> None:
    op.drop_constraint("uq_workout_client_token", "workout", type_="unique")
    op.drop_column("workout", "client_token")
    op.drop_constraint("uq_exercise_client_token", "exercise", type_="unique")
    op.drop_column("exercise", "client_token")
