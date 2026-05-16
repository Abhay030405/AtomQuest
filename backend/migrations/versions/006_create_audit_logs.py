"""create audit logs

Revision ID: 006
Revises: 005
Create Date: 2026-05-16
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Immutable — no is_deleted or updated_at
    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("table_name", sa.String(100), nullable=False),
        sa.Column("record_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "action",
            sa.Enum("insert", "update", "delete", name="audit_action"),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(100), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "actor_role",
            # user_role enum already created in migration 001 — reuse it
            sa.Enum("employee", "manager", "admin", name="user_role", create_type=False),
            nullable=False,
        ),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("request_id", sa.String(100), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_audit_logs_table_record", "audit_logs", ["table_name", "record_id"])
    op.create_index("ix_audit_logs_actor", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_changed_at", "audit_logs", ["changed_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_changed_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor", table_name="audit_logs")
    op.drop_index("ix_audit_logs_table_record", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.execute("DROP TYPE IF EXISTS audit_action")
    # user_role enum is still used by users table — dropped in migration 001 downgrade
