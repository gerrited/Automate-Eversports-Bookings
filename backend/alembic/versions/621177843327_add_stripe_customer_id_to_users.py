"""add stripe_customer_id to users

Revision ID: 621177843327
Revises: f2e233c3cee1
Create Date: 2026-04-24 21:26:56.764167

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '621177843327'
down_revision: Union[str, None] = 'f2e233c3cee1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('stripe_customer_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'stripe_customer_id')
