"""add problems and tomorrow_plan to daily_work_logs

Revision ID: 004
Revises: 003
Create Date: 2024-01-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 为 daily_work_logs 表添加 problems 和 tomorrow_plan 字段
    op.add_column('daily_work_logs', sa.Column('problems', sa.Text(), nullable=True, comment='遇到的问题'))
    op.add_column('daily_work_logs', sa.Column('tomorrow_plan', sa.Text(), nullable=True, comment='明日计划'))


def downgrade() -> None:
    op.drop_column('daily_work_logs', 'tomorrow_plan')
    op.drop_column('daily_work_logs', 'problems')
