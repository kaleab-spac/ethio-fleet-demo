"""add status and driver_id to users

Revision ID: 398722021c75
Revises: fe40ab3548dc
Create Date: 2026-10-14 14:38:19.966019

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '398722021c75'
down_revision: Union[str, Sequence[str], None] = 'fe40ab3548dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=20), server_default='active', nullable=False))
        batch_op.add_column(sa.Column('driver_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_users_driver_id', 'drivers', ['driver_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_driver_id', type_='foreignkey')
        batch_op.drop_column('driver_id')
        batch_op.drop_column('status')