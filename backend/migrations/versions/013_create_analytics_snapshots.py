"""create analytics snapshots

Revision ID: 013
Revises: 012
Create Date: 2026-05-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Lite CQRS read projection. Dashboards read 1 row per user instead of a
    # multi-table JOIN. Kept current by SnapshotUpdateHandler (event subscriber).
    op.create_table(
        "analytics_snapshots",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "quarter",
            # quarter enum created in migration 009 — reuse it.
            # postgresql.ENUM honours create_type=False reliably in op.create_table.
            postgresql.ENUM(
                "q1", "q2", "q3", "q4", name="quarter", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Nullable: derived from the user; some users (e.g. admin) may lack a
        # department or a manager. Snapshot must still be generatable.
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Nullable: WeightedScoreAggregator.compute() returns None when no
        # goals have scores yet.
        sa.Column("weighted_score", sa.Numeric(8, 4), nullable=True),
        sa.Column("goals_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("goals_submitted", sa.Integer(), server_default="0", nullable=False),
        sa.Column("goals_completed", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "checkin_done",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "achievement_submitted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "snapshot_generated_at",
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
        # No ON DELETE CASCADE — soft-delete model
        sa.ForeignKeyConstraint(["cycle_id"], ["cycle_configs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "quarter",
            "cycle_id",
            name="uq_analytics_snapshots_user_quarter_cycle",
        ),
    )

    op.create_index(
        "ix_analytics_snapshots_dept_quarter",
        "analytics_snapshots",
        ["department_id", "quarter"],
    )
    op.create_index(
        "ix_analytics_snapshots_manager_quarter",
        "analytics_snapshots",
        ["manager_id", "quarter"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_analytics_snapshots_manager_quarter", table_name="analytics_snapshots"
    )
    op.drop_index(
        "ix_analytics_snapshots_dept_quarter", table_name="analytics_snapshots"
    )
    op.drop_table("analytics_snapshots")
    # quarter enum is dropped by migration 009 downgrade
