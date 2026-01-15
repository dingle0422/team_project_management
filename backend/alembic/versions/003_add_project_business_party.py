"""Add business_party column to projects table

Revision ID: 003
Revises: 002
Create Date: 2026-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    # Add business_party column to projects table
    op.add_column('projects', sa.Column('business_party', sa.String(200), nullable=True, comment='业务方'))


def downgrade():
    op.drop_column('projects', 'business_party')
