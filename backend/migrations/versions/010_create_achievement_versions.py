"""create achievement versions

Revision ID: 010
Revises: 009
Create Date: 2026-05-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Immutable snapshot table (append-only). Phase 2 plan §1 still mandates
    # the full BaseModel contract on every Phase 2 table.
    op.create_table(
        "achievement_versions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("achievement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("actual_value", sa.Numeric(15, 4), nullable=True),
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            # achievement_status enum created in migration 009 — reuse it.
            # Use postgresql.ENUM (not sa.Enum) so Alembic reliably honours
            # create_type=False during op.create_table on a partial-state DB.
            postgresql.ENUM(
                "not_started",
                "on_track",
                "completed",
                name="achievement_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("computed_score", sa.Numeric(8, 4), nullable=True),
        sa.Column("score_formula_used", sa.String(50), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_by", postgresql.UUID(as_uuid=True), nullable=True),
        # Always required — no silent re-submissions
        sa.Column("edit_reason", sa.Text(), nullable=False),
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
        # No ON DELETE CASCADE — version history must survive for the audit trail
        sa.ForeignKeyConstraint(["achievement_id"], ["achievements.id"]),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "achievement_id",
            "version_number",
            name="uq_achievement_versions_achievement_version",
        ),
    )

    # uq_achievement_versions_achievement_version provides the leftmost-prefix
    # index for "all versions of an achievement" lookups (audit trail).


def downgrade() -> None:
    op.drop_table("achievement_versions")
    # achievement_status enum is dropped by migration 009 downgrade
