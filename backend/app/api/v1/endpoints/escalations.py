"""Escalation API — Admin-only endpoints for rule management, log inspection,
and the "Run Now" manual trigger.

Routes
------
POST   /escalations/rules                   create a new rule
GET    /escalations/rules                   list all rules
GET    /escalations/rules/{rule_id}         get single rule
PATCH  /escalations/rules/{rule_id}         update rule
DELETE /escalations/rules/{rule_id}         soft-delete rule

GET    /escalations/logs                    list logs (filterable)
POST   /escalations/run-now                 trigger an immediate engine run
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.core.exceptions import AtomQuestException
from app.repositories.escalation_repository import (
    EscalationLogRepository,
    EscalationRuleRepository,
)
from app.schemas.common import APIResponse
from app.schemas.escalation import (
    EscalationLogResponse,
    EscalationRuleCreate,
    EscalationRuleResponse,
    EscalationRuleUpdate,
    EscalationRunResult,
)
from app.services.escalation_scheduler import run_now


router = APIRouter()


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------


@router.post("/rules", response_model=APIResponse[EscalationRuleResponse], status_code=201)
async def create_rule(
    payload: EscalationRuleCreate,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EscalationRuleRepository(db)
    try:
        rule = await repo.create(
            {
                **payload.model_dump(),
                "escalation_chain": [s.model_dump() for s in payload.escalation_chain],
                "created_by": current_admin.id,
            }
        )
        await db.commit()
        await db.refresh(rule)
    except Exception:
        await db.rollback()
        raise
    return APIResponse.ok(EscalationRuleResponse.model_validate(rule))


@router.get("/rules", response_model=APIResponse[list[EscalationRuleResponse]])
async def list_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EscalationRuleRepository(db)
    rules = await repo.list_all(skip=skip, limit=limit)
    return APIResponse.ok([EscalationRuleResponse.model_validate(r) for r in rules])


@router.get("/rules/{rule_id}", response_model=APIResponse[EscalationRuleResponse])
async def get_rule(
    rule_id: UUID,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EscalationRuleRepository(db)
    rule = await repo.get(rule_id)
    if rule is None:
        raise AtomQuestException("RULE_NOT_FOUND", "Escalation rule not found", 404)
    return APIResponse.ok(EscalationRuleResponse.model_validate(rule))


@router.patch("/rules/{rule_id}", response_model=APIResponse[EscalationRuleResponse])
async def update_rule(
    rule_id: UUID,
    payload: EscalationRuleUpdate,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EscalationRuleRepository(db)
    rule = await repo.get(rule_id)
    if rule is None:
        raise AtomQuestException("RULE_NOT_FOUND", "Escalation rule not found", 404)
    try:
        update_data = payload.model_dump(exclude_unset=True)
        if "escalation_chain" in update_data and update_data["escalation_chain"] is not None:
            update_data["escalation_chain"] = [
                s.model_dump() for s in payload.escalation_chain
            ]
        rule = await repo.update(rule, update_data)
        await db.commit()
        await db.refresh(rule)
    except Exception:
        await db.rollback()
        raise
    return APIResponse.ok(EscalationRuleResponse.model_validate(rule))


@router.delete("/rules/{rule_id}", response_model=APIResponse[None])
async def delete_rule(
    rule_id: UUID,
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EscalationRuleRepository(db)
    rule = await repo.get(rule_id)
    if rule is None:
        raise AtomQuestException("RULE_NOT_FOUND", "Escalation rule not found", 404)
    try:
        await repo.soft_delete(rule)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return APIResponse.ok(None)


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------


@router.get("/logs", response_model=APIResponse[list[EscalationLogResponse]])
async def list_logs(
    rule_id: Optional[UUID] = Query(None),
    subject_user_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None, pattern=r"^(open|resolved)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EscalationLogRepository(db)
    logs = await repo.list_logs(
        rule_id=rule_id,
        subject_user_id=subject_user_id,
        status=status,
        skip=skip,
        limit=limit,
    )
    return APIResponse.ok([EscalationLogResponse.model_validate(log) for log in logs])


# ---------------------------------------------------------------------------
# Run Now (hackathon demo button)
# ---------------------------------------------------------------------------


@router.post("/run-now", response_model=APIResponse[EscalationRunResult])
async def trigger_run_now(
    current_admin=Depends(get_current_admin),
):
    """Immediately trigger the escalation engine.  Useful during live demos."""
    await run_now()
    return APIResponse.ok(EscalationRunResult(rules_evaluated=-1, notifications_sent=-1))
