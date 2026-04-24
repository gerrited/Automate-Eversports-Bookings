"""add_total_bookings_executed_to_users

Revision ID: a3b611fade3f
Revises: f2e233c3cee1
Create Date: 2026-04-24 21:37:52.335007

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b611fade3f'
down_revision: Union[str, None] = 'f2e233c3cee1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('total_bookings_executed', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('users', 'total_bookings_executed')
