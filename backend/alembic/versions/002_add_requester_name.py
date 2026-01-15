"""Add requester_name column to tasks table

Revision ID: 002
Revises: 001
Create Date: 2026-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # Add requester_name column to tasks table
    op.add_column('tasks', sa.Column('requester_name', sa.String(100), nullable=True, comment='需求方名称'))


def downgrade():
    op.drop_column('tasks', 'requester_name')
