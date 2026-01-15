"""Add task status approvals table

Revision ID: 001
Revises: 
Create Date: 2026-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create task_status_approvals table
    op.create_table(
        'task_status_approvals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('status_change_id', sa.Integer(), nullable=False),
        sa.Column('stakeholder_id', sa.Integer(), nullable=False),
        sa.Column('approval_status', sa.String(20), server_default='pending', nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['status_change_id'], ['task_status_history.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['stakeholder_id'], ['members.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('task_status_approvals')
