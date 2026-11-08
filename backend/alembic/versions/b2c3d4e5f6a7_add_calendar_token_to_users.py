"""add calendar_token to users

Revision ID: b2c3d4e5f6a7
Revises: a5b6c7d8e9f0
Create Date: 2026-06-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table: nötig für SQLite (kein ALTER für Constraints),
    # auf PostgreSQL identisch zu add_column + create_unique_constraint
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('calendar_token', sa.String(), nullable=True))
        batch_op.create_unique_constraint('uq_users_calendar_token', ['calendar_token'])


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('uq_users_calendar_token', type_='unique')
        batch_op.drop_column('calendar_token')
