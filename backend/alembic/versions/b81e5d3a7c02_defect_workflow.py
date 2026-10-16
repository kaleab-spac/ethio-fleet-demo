"""defect workflow

Revision ID: b81e5d3a7c02
Revises: f3a91c7d2b10
Create Date: 2026-10-17 09:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b81e5d3a7c02'
down_revision: Union[str, Sequence[str], None] = 'f3a91c7d2b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('defect_reports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('odometer_km', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('resolution', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=True))

    op.create_table(
        'defect_comments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('defect_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.String(length=500), nullable=False),
        sa.Column('visible_to_driver', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['defect_id'], ['defect_reports.id'], name='fk_defect_comments_defect_id'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], name='fk_defect_comments_author_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_defect_comments_id', 'defect_comments', ['id'], unique=False)
    op.create_index('ix_defect_comments_defect_id', 'defect_comments', ['defect_id'], unique=False)

    op.create_table(
        'defect_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('defect_id', sa.Integer(), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('from_status', sa.String(length=20), nullable=True),
        sa.Column('to_status', sa.String(length=20), nullable=False),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['defect_id'], ['defect_reports.id'], name='fk_defect_history_defect_id'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], name='fk_defect_history_actor_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_defect_history_id', 'defect_history', ['id'], unique=False)
    op.create_index('ix_defect_history_defect_id', 'defect_history', ['defect_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_defect_history_defect_id', table_name='defect_history')
    op.drop_index('ix_defect_history_id', table_name='defect_history')
    op.drop_table('defect_history')
    op.drop_index('ix_defect_comments_defect_id', table_name='defect_comments')
    op.drop_index('ix_defect_comments_id', table_name='defect_comments')
    op.drop_table('defect_comments')
    with op.batch_alter_table('defect_reports', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('resolution')
        batch_op.drop_column('odometer_km')
        batch_op.drop_column('category')