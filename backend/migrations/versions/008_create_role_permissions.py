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

    # Seed all 25 RBAC rows using raw SQL with explicit enum casts.
    # op.bulk_insert with sa.String columns fails on asyncpg because PostgreSQL
    # won't implicitly cast VARCHAR → user_role; explicit ::user_role cast required.
    op.execute(sa.text("""
        INSERT INTO role_permissions (role, permission_key) VALUES
        -- EMPLOYEE (4)
        ('employee'::user_role, 'create_goal'),
        ('employee'::user_role, 'submit_goal_sheet'),
        ('employee'::user_role, 'edit_own_draft_goal'),
        ('employee'::user_role, 'view_own_goals'),
        -- MANAGER (6)
        ('manager'::user_role, 'view_own_goals'),
        ('manager'::user_role, 'view_team_goals'),
        ('manager'::user_role, 'approve_goal'),
        ('manager'::user_role, 'reject_goal'),
        ('manager'::user_role, 'edit_goal_in_review'),
        ('manager'::user_role, 'return_for_rework'),
        -- ADMIN (15)
        ('admin'::user_role, 'create_goal'),
        ('admin'::user_role, 'submit_goal_sheet'),
        ('admin'::user_role, 'edit_own_draft_goal'),
        ('admin'::user_role, 'view_own_goals'),
        ('admin'::user_role, 'view_team_goals'),
        ('admin'::user_role, 'approve_goal'),
        ('admin'::user_role, 'reject_goal'),
        ('admin'::user_role, 'edit_goal_in_review'),
        ('admin'::user_role, 'return_for_rework'),
        ('admin'::user_role, 'push_shared_goal'),
        ('admin'::user_role, 'unlock_goal'),
        ('admin'::user_role, 'configure_cycle'),
        ('admin'::user_role, 'view_all_goals'),
        ('admin'::user_role, 'export_reports'),
        ('admin'::user_role, 'view_audit_log')
    """))


def downgrade() -> None:
    op.drop_table("role_permissions")
    # user_role enum still used by users and audit_logs — dropped in migration 001 downgrade
