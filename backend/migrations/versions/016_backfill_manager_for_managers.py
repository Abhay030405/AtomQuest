"""backfill manager_id for manager-role users so they report to an admin

Revision ID: 016
Revises: 015
Create Date: 2026-05-19
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Every manager-role user should report to an admin. Pick the oldest active
    # admin as the org-wide "head" and assign them to any manager whose
    # manager_id is currently NULL.
    op.execute(sa.text("""
        WITH head_admin AS (
            SELECT id
            FROM users
            WHERE role = 'admin' AND is_active = TRUE AND is_deleted = FALSE
            ORDER BY created_at ASC
            LIMIT 1
        )
        UPDATE users u
        SET manager_id = ha.id
        FROM head_admin ha
        WHERE u.role = 'manager'
          AND u.manager_id IS NULL
          AND u.is_deleted = FALSE
    """))


def downgrade() -> None:
    # Best-effort: clear manager_id on managers whose manager is an admin. We
    # can't reliably distinguish backfilled vs. organically-set values, so this
    # is a soft revert.
    op.execute(sa.text("""
        UPDATE users u
        SET manager_id = NULL
        FROM users m
        WHERE u.manager_id = m.id
          AND u.role = 'manager'
          AND m.role = 'admin'
    """))
