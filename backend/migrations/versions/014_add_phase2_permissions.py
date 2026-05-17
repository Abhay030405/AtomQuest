"""add phase 2 permissions to role_permissions

Revision ID: 014
Revises: 013
Create Date: 2026-05-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Phase 2 permission keys (lowercase to match Permission enum .value)
_PHASE2_KEYS = (
    "log_achievement",
    "resubmit_achievement",
    "conduct_checkin",
    "edit_checkin",
    "acknowledge_checkin",
    "view_analytics",
    "export_achievement_report",
)


def upgrade() -> None:
    op.execute(sa.text("""
        INSERT INTO role_permissions (role, permission_key) VALUES
        -- EMPLOYEE Phase 2 (3)
        ('employee'::user_role, 'log_achievement'),
        ('employee'::user_role, 'resubmit_achievement'),
        ('employee'::user_role, 'acknowledge_checkin'),
        -- MANAGER Phase 2 (2)
        ('manager'::user_role, 'conduct_checkin'),
        ('manager'::user_role, 'edit_checkin'),
        -- ADMIN Phase 2 (7 — admin gets list(Permission), so all keys)
        ('admin'::user_role, 'log_achievement'),
        ('admin'::user_role, 'resubmit_achievement'),
        ('admin'::user_role, 'conduct_checkin'),
        ('admin'::user_role, 'edit_checkin'),
        ('admin'::user_role, 'acknowledge_checkin'),
        ('admin'::user_role, 'view_analytics'),
        ('admin'::user_role, 'export_achievement_report')
    """))


def downgrade() -> None:
    keys_sql = ", ".join(f"'{k}'" for k in _PHASE2_KEYS)
    op.execute(sa.text(
        f"DELETE FROM role_permissions WHERE permission_key IN ({keys_sql})"
    ))
