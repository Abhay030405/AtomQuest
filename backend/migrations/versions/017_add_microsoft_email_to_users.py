"""add microsoft_email to users

Revision ID: 017
Revises: 016
Create Date: 2026-05-19
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("microsoft_email", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_users_microsoft_email",
        "users",
        ["microsoft_email"],
        unique=True,
        postgresql_where=sa.text("microsoft_email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_microsoft_email", table_name="users")
    op.drop_column("users", "microsoft_email")
