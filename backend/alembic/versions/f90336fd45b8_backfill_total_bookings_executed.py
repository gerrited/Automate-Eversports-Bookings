"""backfill_total_bookings_executed

Revision ID: f90336fd45b8
Revises: a3b611fade3f
Create Date: 2026-04-24 21:47:37.167558

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'f90336fd45b8'
down_revision: Union[str, None] = 'a3b611fade3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("""
        UPDATE users
        SET total_bookings_executed = (
            SELECT COUNT(*)
            FROM booking_logs bl
            JOIN booking_jobs bj ON bl.job_id = bj.id
            WHERE bj.user_id = users.id
            AND bl.status IN ('success', 'already_booked', 'waitlist')
        )
    """))


def downgrade() -> None:
    op.execute(text("UPDATE users SET total_bookings_executed = 0"))
