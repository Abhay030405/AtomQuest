"""create checkins

Revision ID: 011
Revises: 010
Create Date: 2026-05-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "checkins",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
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
        # min 20 characters enforced at service layer
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column(
            "comment_type",
            sa.Enum("structured", "freeform", name="checkin_comment_type"),
            server_default="freeform",
            nullable=False,
        ),
        # Goal IDs covered in this check-in
        sa.Column(
            "goals_discussed",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=True,
        ),
        sa.Column(
            "overall_rating_sentiment",
            sa.Enum(
                "positive",
                "neutral",
                "needs_attention",
                name="checkin_rating_sentiment",
            ),
            nullable=True,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_acknowledged_by_employee",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["cycle_id"], ["cycle_configs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "manager_id",
            "employee_id",
            "quarter",
            "cycle_id",
            name="uq_checkins_manager_employee_quarter_cycle",
        ),
    )

    op.create_index(
        "ix_checkins_manager_quarter", "checkins", ["manager_id", "quarter"]
    )


def downgrade() -> None:
    op.drop_index("ix_checkins_manager_quarter", table_name="checkins")
    op.drop_table("checkins")
    op.execute("DROP TYPE IF EXISTS checkin_rating_sentiment")
    op.execute("DROP TYPE IF EXISTS checkin_comment_type")
    # quarter enum is dropped by migration 009 downgrade
