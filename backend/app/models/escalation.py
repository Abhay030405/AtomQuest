from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class EscalationTrigger(str):
    GOALS_NOT_SUBMITTED = "goals_not_submitted"
    MANAGER_APPROVAL_OVERDUE = "manager_approval_overdue"
    CHECKIN_NOT_COMPLETED = "checkin_not_completed"


class EscalationRule(BaseModel):
    """Admin-configurable rule driving the escalation engine.

    ``escalation_chain`` is a JSON array describing each notification level:
    [
        {"target": "self",    "delay_days": 0},
        {"target": "manager", "delay_days": 3},
        {"target": "hr",      "delay_days": 5}
    ]

    ``trigger_condition`` is one of the three canonical strings in
    EscalationTrigger.  ``threshold_days`` is N in the problem statement:
    "N days after the window opens / after submission."
    """

    __tablename__ = "escalation_rules"

    name = Column(String(200), nullable=False)
    trigger_condition = Column(String(100), nullable=False)
    threshold_days = Column(Integer, nullable=False)
    escalation_chain = Column(JSON, nullable=False, default=list)
    notification_title_template = Column(String(500), nullable=False)
    notification_body_template = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    logs = relationship("EscalationLog", back_populates="rule", lazy="dynamic")


class EscalationLogStatus(str):
    OPEN = "open"
    RESOLVED = "resolved"


class EscalationLog(BaseModel):
    """One row per (rule, subject_user, escalation_level) notification sent.

    ``subject_user_id`` is the person who triggered the condition (employee
    or manager depending on the rule).
    ``notified_user_id`` is the recipient of the actual notification at that
    level (self / manager / HR admin).
    ``chain_level`` is the 0-based index into rule.escalation_chain.
    ``status`` is open until the underlying condition is resolved, at which
    point the service sets it to "resolved" and records resolved_at.
    """

    __tablename__ = "escalation_logs"

    rule_id = Column(PG_UUID(as_uuid=True), ForeignKey("escalation_rules.id"), nullable=False)
    subject_user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notified_user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    chain_level = Column(Integer, nullable=False, default=0)
    trigger_fired_at = Column(DateTime(timezone=True), nullable=False)
    notified_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default=EscalationLogStatus.OPEN)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    cycle_id = Column(PG_UUID(as_uuid=True), ForeignKey("cycle_configs.id"), nullable=True)
    # extra context stored for display / auditing (e.g. quarter name)
    context_data = Column(JSON, nullable=True)

    rule = relationship("EscalationRule", back_populates="logs")
    subject_user = relationship("User", foreign_keys=[subject_user_id])
    notified_user = relationship("User", foreign_keys=[notified_user_id])
    cycle = relationship("CycleConfig")
