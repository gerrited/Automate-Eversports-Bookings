"""add max_active_jobs to users

Revision ID: f2e233c3cee1
Revises: f3a4b5c6d7e8
Create Date: 2026-04-24 19:43:06.032302

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2e233c3cee1'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('max_active_jobs', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'max_active_jobs')
