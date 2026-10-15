"""add client_token to workout_session (idempotent offline create)

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("workout_session", sa.Column("client_token", sa.String(length=64), nullable=True))
    op.create_unique_constraint(
        "uq_workout_session_client_token", "workout_session", ["client_token"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_workout_session_client_token", "workout_session", type_="unique")
    op.drop_column("workout_session", "client_token")
