"""create notifications

Revision ID: 007
Revises: 006
Create Date: 2026-05-16
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "notification_type",
            sa.Enum(
                "goal_submitted",
                "goal_approved",
                "goal_returned",
                "goal_unlocked",
                "shared_goal_received",
                "checkin_completed",
                "window_opening",
                name="notification_type",
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "is_read",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deep_link", sa.String(500), nullable=True),
        sa.Column("related_goal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["related_goal_id"], ["goals.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_notifications_recipient_is_read",
        "notifications",
        ["recipient_id", "is_read"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_is_read", table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notification_type")
