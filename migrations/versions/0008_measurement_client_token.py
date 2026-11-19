"""client_token em body_measurement (criacao idempotente offline)

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("body_measurement", sa.Column("client_token", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_measurement_client_token", "body_measurement", ["client_token"])


def downgrade() -> None:
    op.drop_constraint("uq_measurement_client_token", "body_measurement", type_="unique")
    op.drop_column("body_measurement", "client_token")
