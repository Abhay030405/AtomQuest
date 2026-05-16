"""create role permissions and seed RBAC matrix

Revision ID: 008
Revises: 007
Create Date: 2026-05-16
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "role",
            sa.Enum("employee", "manager", "admin", name="user_role", create_type=False),
            nullable=False,
        ),
        sa.Column("permission_key", sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role", "permission_key", name="uq_role_permission"),
    )

    # Seed all 25 rows from RBAC_MATRIX (4 employee + 6 manager + 15 admin)
    op.bulk_insert(
        sa.table(
            "role_permissions",
            sa.column("role", sa.String),
            sa.column("permission_key", sa.String),
        ),
        [
            # EMPLOYEE — 4 permissions
            {"role": "employee", "permission_key": "create_goal"},
            {"role": "employee", "permission_key": "submit_goal_sheet"},
            {"role": "employee", "permission_key": "edit_own_draft_goal"},
            {"role": "employee", "permission_key": "view_own_goals"},
            # MANAGER — 6 permissions
            {"role": "manager", "permission_key": "view_own_goals"},
            {"role": "manager", "permission_key": "view_team_goals"},
            {"role": "manager", "permission_key": "approve_goal"},
            {"role": "manager", "permission_key": "reject_goal"},
            {"role": "manager", "permission_key": "edit_goal_in_review"},
            {"role": "manager", "permission_key": "return_for_rework"},
            # ADMIN — all 15 permissions
            {"role": "admin", "permission_key": "create_goal"},
            {"role": "admin", "permission_key": "submit_goal_sheet"},
            {"role": "admin", "permission_key": "edit_own_draft_goal"},
            {"role": "admin", "permission_key": "view_own_goals"},
            {"role": "admin", "permission_key": "view_team_goals"},
            {"role": "admin", "permission_key": "approve_goal"},
            {"role": "admin", "permission_key": "reject_goal"},
            {"role": "admin", "permission_key": "edit_goal_in_review"},
            {"role": "admin", "permission_key": "return_for_rework"},
            {"role": "admin", "permission_key": "push_shared_goal"},
            {"role": "admin", "permission_key": "unlock_goal"},
            {"role": "admin", "permission_key": "configure_cycle"},
            {"role": "admin", "permission_key": "view_all_goals"},
            {"role": "admin", "permission_key": "export_reports"},
            {"role": "admin", "permission_key": "view_audit_log"},
        ],
    )


def downgrade() -> None:
    op.drop_table("role_permissions")
    # user_role enum still used by users and audit_logs — dropped in migration 001 downgrade
