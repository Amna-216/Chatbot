"""add username to users

Revision ID: 0004_add_username
Revises: 0003_users_and_chat_ownership
Create Date: 2026-04-04 18:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_add_username"
down_revision: Union[str, None] = "0003_users_and_chat_ownership"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.Text(), nullable=True))

    op.execute(
        """
        UPDATE users
        SET username = split_part(email, '@', 1) || '_' || id
        WHERE username IS NULL OR username = ''
        """
    )

    op.alter_column("users", "username", existing_type=sa.Text(), nullable=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "username")
