"""add active and role to users

Revision ID: a1b2c3d4e5f6
Revises: 5513b0f9e2a5
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5513b0f9e2a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default='1' ensures existing users stay active and aren't locked out
    op.add_column('users', sa.Column('active', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('users', sa.Column('role', sa.String(), nullable=False, server_default='user'))


def downgrade() -> None:
    op.drop_column('users', 'role')
    op.drop_column('users', 'active')
