"""add_facility_name_to_booking_jobs

Revision ID: 237a66a44ff1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-16 09:36:27.938531

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '237a66a44ff1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default='' keeps existing rows valid without a data migration
    op.add_column('booking_jobs', sa.Column('facility_name', sa.String(), nullable=False, server_default=''))


def downgrade() -> None:
    op.drop_column('booking_jobs', 'facility_name')
