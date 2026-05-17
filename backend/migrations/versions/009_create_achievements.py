"""create achievements

Revision ID: 009
Revises: 008
Create Date: 2026-05-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 2 plan §1: ALL Phase 2 tables follow the BaseModel contract
    # (id, created_at, updated_at, is_deleted). Append-only behaviour is
    # enforced at the service layer, not by dropping these columns.
    op.create_table(
        "achievements",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "quarter",
            sa.Enum("q1", "q2", "q3", "q4", name="quarter"),
            nullable=False,
        ),
        # NULL = not yet submitted
        sa.Column("actual_value", sa.Numeric(15, 4), nullable=True),
        # Used only when uom_type = 'timeline'
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "not_started",
                "on_track",
                "completed",
                name="achievement_status",
            ),
            server_default="not_started",
            nullable=False,
        ),
        # Nullable: TimelineScoringStrategy returns None while in-progress
        sa.Column("computed_score", sa.Numeric(8, 4), nullable=True),
        sa.Column("score_formula_used", sa.String(50), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "is_synced_from_shared",
            sa.Boolean(),
            server_default=sa.text("false"),
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
        # No ON DELETE CASCADE — soft-delete model, FK rows are never hard-deleted
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"]),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("goal_id", "quarter", name="uq_achievements_goal_quarter"),
    )

    # uq_achievements_goal_quarter already provides the composite
    # (goal_id, quarter) lookup index. A standalone goal_id index is added
    # for "all quarters for a goal" scans.
    op.create_index("ix_achievements_goal_id", "achievements", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_achievements_goal_id", table_name="achievements")
    op.drop_table("achievements")
    # quarter + achievement_status enums are shared by later Phase 2 tables;
    # those migrations downgrade first, so it is safe to drop the types here.
    op.execute("DROP TYPE IF EXISTS achievement_status")
    op.execute("DROP TYPE IF EXISTS quarter")
