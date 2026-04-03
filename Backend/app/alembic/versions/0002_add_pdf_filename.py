"""add pdf filename column

Revision ID: 0002_add_pdf_filename
Revises: 0001_initial
Create Date: 2026-04-03 14:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_add_pdf_filename"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("pdf_filename", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "pdf_filename")
