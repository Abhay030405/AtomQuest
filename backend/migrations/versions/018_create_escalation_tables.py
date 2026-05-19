"""create escalation_rules and escalation_logs tables

Revision ID: 018
Revises: 017
Create Date: 2026-05-19
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = bind.execute(
        sa.text("SELECT tablename FROM pg_tables WHERE schemaname='public'")
    ).scalars().all()

    # ------------------------------------------------------------------
    # escalation_rules
    # ------------------------------------------------------------------
    if "escalation_rules" not in existing_tables:
     op.create_table(
        "escalation_rules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("trigger_condition", sa.String(100), nullable=False),
        sa.Column("threshold_days", sa.Integer(), nullable=False),
        sa.Column(
            "escalation_chain",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("notification_title_template", sa.String(500), nullable=False),
        sa.Column("notification_body_template", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
     )
     op.create_index("ix_escalation_rules_is_active", "escalation_rules", ["is_active"], if_not_exists=True)
     op.create_index(
        "ix_escalation_rules_trigger_condition",
        "escalation_rules",
        ["trigger_condition"],
        if_not_exists=True,
     )

    # ------------------------------------------------------------------
    # escalation_logs
    # ------------------------------------------------------------------
    if "escalation_logs" not in existing_tables:
     op.create_table(
        "escalation_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("escalation_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "subject_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "notified_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chain_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("trigger_fired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "cycle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cycle_configs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "context_data",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
     )
     op.create_index(
        "ix_escalation_logs_rule_subject",
        "escalation_logs",
        ["rule_id", "subject_user_id"],
        if_not_exists=True,
     )
     op.create_index("ix_escalation_logs_status", "escalation_logs", ["status"], if_not_exists=True)
     op.create_index(
        "ix_escalation_logs_subject_user_id", "escalation_logs", ["subject_user_id"],
        if_not_exists=True,
     )


def downgrade() -> None:
    op.drop_table("escalation_logs")
    op.drop_table("escalation_rules")
