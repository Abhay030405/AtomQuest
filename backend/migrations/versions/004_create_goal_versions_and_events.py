"""create goal versions and events

Revision ID: 004
Revises: 003
Create Date: 2026-05-16
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Immutable — no is_deleted or updated_at
    op.create_table(
        "goal_versions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "thrust_area",
            # Enum already created in migration 003 — reuse without re-creating
            sa.Enum(
                "revenue_growth",
                "customer_satisfaction",
                "operational_excellence",
                "people_development",
                "safety_compliance",
                "innovation",
                "cost_optimisation",
                "quality",
                name="thrust_area",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "uom_type",
            sa.Enum("min", "max", "timeline", "zero", name="uom_type", create_type=False),
            nullable=False,
        ),
        sa.Column("target_value", sa.Numeric(15, 4), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("weightage", sa.Numeric(5, 2), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "submitted",
                "under_review",
                "approved",
                "locked",
                "archived",
                name="goal_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("change_reason", sa.Text(), nullable=True),
        sa.Column(
            "snapshot_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"]),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("goal_id", "version_number", name="uq_goal_versions_goal_version"),
    )

    # Immutable — no is_deleted or updated_at
    op.create_table(
        "goal_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "goal_created",
                "goal_submitted",
                "goal_returned_for_rework",
                "goal_approved",
                "goal_locked",
                "goal_unlocked",
                "target_edited_by_manager",
                "weightage_edited_by_manager",
                "shared_goal_pushed",
                "shared_goal_received",
                name="goal_event_type",
            ),
            nullable=False,
        ),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_goal_events_goal_event", "goal_events", ["goal_id", "event_type"])


def downgrade() -> None:
    op.drop_index("ix_goal_events_goal_event", table_name="goal_events")
    op.drop_table("goal_events")
    op.drop_table("goal_versions")
    op.execute("DROP TYPE IF EXISTS goal_event_type")
    # thrust_area, uom_type, goal_status dropped in migration 003 downgrade
