"""create checkin events

Revision ID: 012
Revises: 011
Create Date: 2026-05-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Event log for all check-in mutations. Append-only; Phase 2 plan §1 still
    # mandates the full BaseModel contract on every Phase 2 table.
    op.create_table(
        "checkin_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("checkin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "event_type",
            # Build plan §1 specifies UPPERCASE values exactly
            sa.Enum(
                "CREATED",
                "UPDATED",
                "ACKNOWLEDGED",
                name="checkin_event_type",
            ),
            nullable=False,
        ),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        # What changed: old/new comment, timestamps
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
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
        # No ON DELETE CASCADE — event history must survive for the audit trail
        sa.ForeignKeyConstraint(["checkin_id"], ["checkins.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_checkin_events_checkin_id", "checkin_events", ["checkin_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_checkin_events_checkin_id", table_name="checkin_events")
    op.drop_table("checkin_events")
    op.execute("DROP TYPE IF EXISTS checkin_event_type")
