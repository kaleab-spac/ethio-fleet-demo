"""maintenance requests

Revision ID: c47d9e1f5a30
Revises: b81e5d3a7c02
Create Date: 2026-10-18 09:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c47d9e1f5a30'
down_revision: Union[str, Sequence[str], None] = 'b81e5d3a7c02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'maintenance_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('driver_id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=30), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('urgency', sa.String(length=10), nullable=False),
        sa.Column('odometer_km', sa.Float(), nullable=False),
        sa.Column('preferred_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('decision_reason', sa.String(length=500), nullable=True),
        sa.Column('scheduled_date', sa.Date(), nullable=True),
        sa.Column('provider', sa.String(length=100), nullable=True),
        sa.Column('defect_id', sa.Integer(), nullable=True),
        sa.Column('maintenance_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['driver_id'], ['drivers.id'], name='fk_mreq_driver_id'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name='fk_mreq_vehicle_id'),
        sa.ForeignKeyConstraint(['defect_id'], ['defect_reports.id'], name='fk_mreq_defect_id'),
        sa.ForeignKeyConstraint(['maintenance_id'], ['maintenance.id'], name='fk_mreq_maintenance_id'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], name='fk_mreq_reviewed_by'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_maintenance_requests_id', 'maintenance_requests', ['id'], unique=False)
    op.create_index('ix_maintenance_requests_driver_id', 'maintenance_requests', ['driver_id'], unique=False)
    op.create_index('ix_maintenance_requests_vehicle_id', 'maintenance_requests', ['vehicle_id'], unique=False)
    op.create_index('ix_maintenance_requests_status', 'maintenance_requests', ['status'], unique=False)
    op.create_index('ix_maintenance_requests_created_at', 'maintenance_requests', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_maintenance_requests_created_at', table_name='maintenance_requests')
    op.drop_index('ix_maintenance_requests_status', table_name='maintenance_requests')
    op.drop_index('ix_maintenance_requests_vehicle_id', table_name='maintenance_requests')
    op.drop_index('ix_maintenance_requests_driver_id', table_name='maintenance_requests')
    op.drop_index('ix_maintenance_requests_id', table_name='maintenance_requests')
    op.drop_table('maintenance_requests')