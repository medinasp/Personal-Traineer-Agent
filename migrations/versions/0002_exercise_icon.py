"""add icon column to exercise

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("exercise", sa.Column("icon", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("exercise", "icon")
