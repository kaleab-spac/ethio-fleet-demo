"""fuel log workflow

Revision ID: f3a91c7d2b10
Revises: dd9ea24b58db
Create Date: 2026-10-16 09:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a91c7d2b10'
down_revision: Union[str, Sequence[str], None] = 'dd9ea24b58db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('fuel_logs', schema=None) as batch_op:
        # Existing rows get "verified" from the server default, so nothing changes for them
        batch_op.add_column(sa.Column('status', sa.String(length=20), server_default='verified', nullable=False))
        batch_op.add_column(sa.Column('driver_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('request_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('station', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('notes', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('review_reason', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('reviewed_by', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('reviewed_at', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key('fk_fuel_logs_driver_id', 'drivers', ['driver_id'], ['id'])
        batch_op.create_foreign_key('fk_fuel_logs_request_id', 'fuel_requests', ['request_id'], ['id'])
        batch_op.create_foreign_key('fk_fuel_logs_reviewed_by', 'users', ['reviewed_by'], ['id'])
        batch_op.create_index('ix_fuel_logs_status', ['status'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('fuel_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_fuel_logs_status')
        batch_op.drop_constraint('fk_fuel_logs_reviewed_by', type_='foreignkey')
        batch_op.drop_constraint('fk_fuel_logs_request_id', type_='foreignkey')
        batch_op.drop_constraint('fk_fuel_logs_driver_id', type_='foreignkey')
        batch_op.drop_column('reviewed_at')
        batch_op.drop_column('reviewed_by')
        batch_op.drop_column('review_reason')
        batch_op.drop_column('notes')
        batch_op.drop_column('station')
        batch_op.drop_column('request_id')
        batch_op.drop_column('driver_id')
        batch_op.drop_column('status')