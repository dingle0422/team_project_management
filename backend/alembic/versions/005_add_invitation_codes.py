"""add invitation codes table

Revision ID: 005_add_invitation_codes
Revises: 004_add_worklog_problems_plan
Create Date: 2026-01-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_add_invitation_codes'
down_revision: Union[str, None] = '004_add_worklog_problems_plan'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'invitation_codes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=32), nullable=False, comment='邀请码'),
        sa.Column('created_by_id', sa.Integer(), nullable=False, comment='创建者ID'),
        sa.Column('used_by_id', sa.Integer(), nullable=True, comment='使用者ID'),
        sa.Column('is_used', sa.Boolean(), nullable=False, default=False, comment='是否已使用'),
        sa.Column('expires_at', sa.DateTime(), nullable=True, comment='过期时间'),
        sa.Column('created_at', sa.DateTime(), nullable=False, comment='创建时间'),
        sa.Column('used_at', sa.DateTime(), nullable=True, comment='使用时间'),
        sa.ForeignKeyConstraint(['created_by_id'], ['members.id'], ),
        sa.ForeignKeyConstraint(['used_by_id'], ['members.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_invitation_codes_code'), 'invitation_codes', ['code'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_invitation_codes_code'), table_name='invitation_codes')
    op.drop_table('invitation_codes')
