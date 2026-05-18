"""add phone_number to users

Revision ID: 015
Revises: 014
Create Date: 2026-05-18
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("phone_number", sa.String(length=20), nullable=True),
    )
    # Backfill dummy numbers for any existing users so legacy rows are not blank.
    # Deterministic: row_number over created_at gives +91-9000000001, 002, ...
    op.execute(sa.text("""
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
            FROM users
            WHERE phone_number IS NULL
        )
        UPDATE users u
        SET phone_number = '+91-90000' || LPAD(ranked.rn::text, 5, '0')
        FROM ranked
        WHERE u.id = ranked.id
    """))


def downgrade() -> None:
    op.drop_column("users", "phone_number")
