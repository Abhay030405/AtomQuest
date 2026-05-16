from __future__ import annotations

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from app.core.constants import AuditAction, UserRole
from app.core.database import Base


class AuditLog(Base):
	__tablename__ = "audit_logs"

	id = Column(
		PG_UUID(as_uuid=True),
		primary_key=True,
		server_default=text("gen_random_uuid()"),
	)
	table_name = Column(String(100), nullable=False)
	record_id = Column(PG_UUID(as_uuid=True), nullable=False)
	action = Column(Enum(AuditAction, name="audit_action", values_callable=lambda x: [e.value for e in x]), nullable=False)
	field_name = Column(String(100), nullable=True)
	old_value = Column(Text, nullable=True)
	new_value = Column(Text, nullable=True)
	actor_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
	actor_role = Column(Enum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]), nullable=False)
	ip_address = Column(String(50), nullable=True)
	request_id = Column(String(100), nullable=True)
	changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	actor = relationship("User")


Index("ix_audit_logs_table_record", AuditLog.table_name, AuditLog.record_id)
Index("ix_audit_logs_actor", AuditLog.actor_id)
Index("ix_audit_logs_changed_at", AuditLog.changed_at)
