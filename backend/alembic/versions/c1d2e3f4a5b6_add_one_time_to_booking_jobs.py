"""add_one_time_to_booking_jobs

Revision ID: c1d2e3f4a5b6
Revises: 237a66a44ff1
Create Date: 2026-04-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = '237a66a44ff1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('booking_jobs', sa.Column(
        'one_time', sa.Boolean(), nullable=False, server_default='false'
    ))


def downgrade() -> None:
    op.drop_column('booking_jobs', 'one_time')
