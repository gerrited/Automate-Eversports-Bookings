"""add next_run_at to booking_jobs

Revision ID: c8d9e0f1a2b3
Revises: b2c3d4e5f6a7
Create Date: 2026-06-10

Fälligkeit als Daten statt 15-Minuten-Slot-Matching: Der Worker wählt Jobs
über next_run_at <= now aus und schreibt nach jedem Lauf den nächsten Termin
zurück. NULL = noch nicht berechnet; wird vom Worker initialisiert.
"""
import sqlalchemy as sa
from alembic import op

revision = "c8d9e0f1a2b3"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_jobs", sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_booking_jobs_next_run_at", "booking_jobs", ["next_run_at"])


def downgrade() -> None:
    op.drop_index("ix_booking_jobs_next_run_at", table_name="booking_jobs")
    op.drop_column("booking_jobs", "next_run_at")
