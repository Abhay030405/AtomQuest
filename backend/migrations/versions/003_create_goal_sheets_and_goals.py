"""create goal sheets and goals

Revision ID: 003
Revises: 002
Create Date: 2026-05-16
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goal_sheets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "submitted", "approved", name="goal_sheet_status"),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("returned_count", sa.Integer(), server_default="0", nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["cycle_id"], ["cycle_configs.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "cycle_id", name="uq_goal_sheet_user_cycle"),
    )

    op.create_table(
        "goals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal_sheet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "thrust_area",
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
            ),
            nullable=False,
        ),
        sa.Column(
            "uom_type",
            sa.Enum("min", "max", "timeline", "zero", name="uom_type"),
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
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column(
            "is_shared",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("source_shared_goal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_by", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["goal_sheet_id"], ["goal_sheets.id"]),
        sa.ForeignKeyConstraint(["cycle_id"], ["cycle_configs.id"]),
        sa.ForeignKeyConstraint(["source_shared_goal_id"], ["goals.id"]),
        sa.ForeignKeyConstraint(["locked_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_goals_user_cycle", "goals", ["user_id", "cycle_id"])
    op.create_index("ix_goals_goal_sheet_id", "goals", ["goal_sheet_id"])
    op.create_index("ix_goals_status", "goals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_goals_status", table_name="goals")
    op.drop_index("ix_goals_goal_sheet_id", table_name="goals")
    op.drop_index("ix_goals_user_cycle", table_name="goals")
    op.drop_table("goals")
    op.drop_table("goal_sheets")
    op.execute("DROP TYPE IF EXISTS goal_status")
    op.execute("DROP TYPE IF EXISTS uom_type")
    op.execute("DROP TYPE IF EXISTS thrust_area")
    op.execute("DROP TYPE IF EXISTS goal_sheet_status")
