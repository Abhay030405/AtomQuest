"""
Seed script — populates the database with demo data.
Run from the backend/ directory:  python scripts/seed_data.py
"""
from __future__ import annotations

import asyncio
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.constants import (
    AuditAction,
    CyclePhase,
    GoalEventType,
    GoalSheetStatus,
    GoalStatus,
    NotificationType,
    ThrustArea,
    UoMType,
    UserRole,
)
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models import (
    AuditLog,
    CycleConfig,
    Department,
    Goal,
    GoalEvent,
    GoalSheet,
    GoalVersion,
    Notification,
    User,
)


_PW_ADMIN = "Admin@1234"
_PW_MANAGER = "Manager@1234"
_PW_EMPLOYEE = "Employee@1234"


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


async def main() -> None:
    async with AsyncSessionLocal() as session:
        # ── Step 1: Departments ────────────────────────────────────────────────
        dept_sales = Department(name="Sales Department")
        dept_ops = Department(name="Operations Department")
        dept_hr = Department(name="HR Department")
        dept_eng = Department(name="Engineering Department")
        session.add_all([dept_sales, dept_ops, dept_hr, dept_eng])
        await session.flush()

        # ── Step 2: Users ──────────────────────────────────────────────────────
        priya = User(
            email="priya@atomberg.com",
            hashed_password=hash_password(_PW_ADMIN),
            full_name="Priya Sharma",
            role=UserRole.ADMIN,
            department_id=dept_hr.id,
            employee_code="AT-H00001",
        )
        session.add(priya)
        await session.flush()

        vikram = User(
            email="vikram@atomberg.com",
            hashed_password=hash_password(_PW_MANAGER),
            full_name="Vikram Nair",
            role=UserRole.MANAGER,
            department_id=dept_sales.id,
            employee_code="AT-M00001",
            manager_id=priya.id,
        )
        kavya = User(
            email="kavya@atomberg.com",
            hashed_password=hash_password(_PW_MANAGER),
            full_name="Kavya Reddy",
            role=UserRole.MANAGER,
            department_id=dept_ops.id,
            employee_code="AT-M00002",
            manager_id=priya.id,
        )
        session.add_all([vikram, kavya])
        await session.flush()

        rahul = User(
            email="rahul@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Rahul Verma",
            role=UserRole.EMPLOYEE,
            department_id=dept_sales.id,
            employee_code="AT-E00001",
            manager_id=vikram.id,
        )
        sneha = User(
            email="sneha@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Sneha Patel",
            role=UserRole.EMPLOYEE,
            department_id=dept_sales.id,
            employee_code="AT-E00002",
            manager_id=vikram.id,
        )
        arjun = User(
            email="arjun@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Arjun Mehta",
            role=UserRole.EMPLOYEE,
            department_id=dept_ops.id,
            employee_code="AT-E00003",
            manager_id=kavya.id,
        )
        divya = User(
            email="divya@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Divya Singh",
            role=UserRole.EMPLOYEE,
            department_id=dept_ops.id,
            employee_code="AT-E00004",
            manager_id=kavya.id,
        )
        session.add_all([rahul, sneha, arjun, divya])
        await session.flush()

        # ── Step 3: Cycle Config — FY2026 windows ─────────────────────────────
        # GOAL_SETTING window closed on May 31. For Phase 2 demo, Q1 is opened
        # early (today: 2026-05-17) so achievement logging / check-ins work live.
        cycle = CycleConfig(
            cycle_name="FY2026",
            phase=CyclePhase.GOAL_SETTING,
            window_open=utc(2026, 5, 1, 0, 0, 0),
            window_close=utc(2026, 5, 31, 23, 59, 59),
            is_active=False,
            created_by=priya.id,
        )
        cycle_q1 = CycleConfig(
            cycle_name="FY2026",
            phase=CyclePhase.Q1,
            window_open=utc(2026, 5, 17, 0, 0, 0),  # opened early for demo
            window_close=utc(2026, 7, 31, 23, 59, 59),
            is_active=True,
            created_by=priya.id,
        )
        cycle_q2 = CycleConfig(
            cycle_name="FY2026",
            phase=CyclePhase.Q2,
            window_open=utc(2026, 10, 1, 0, 0, 0),
            window_close=utc(2026, 10, 31, 23, 59, 59),
            is_active=False,
            created_by=priya.id,
        )
        cycle_q3 = CycleConfig(
            cycle_name="FY2026",
            phase=CyclePhase.Q3,
            window_open=utc(2027, 1, 1, 0, 0, 0),
            window_close=utc(2027, 1, 31, 23, 59, 59),
            is_active=False,
            created_by=priya.id,
        )
        cycle_q4 = CycleConfig(
            cycle_name="FY2026",
            phase=CyclePhase.Q4,
            window_open=utc(2027, 4, 1, 0, 0, 0),
            window_close=utc(2027, 4, 30, 23, 59, 59),
            is_active=False,
            created_by=priya.id,
        )
        session.add_all([cycle, cycle_q1, cycle_q2, cycle_q3, cycle_q4])
        await session.flush()

        # ── Step 4: Rahul — APPROVED sheet, LOCKED goals ──────────────────────
        rahul_sheet = GoalSheet(
            user_id=rahul.id,
            cycle_id=cycle.id,
            status=GoalSheetStatus.APPROVED,
            submitted_at=utc(2026, 5, 2, 10, 0, 0),
            approved_at=utc(2026, 5, 4, 9, 0, 0),
            approved_by=vikram.id,
        )
        session.add(rahul_sheet)
        await session.flush()

        locked_at = utc(2026, 5, 4, 11, 0, 0)

        rahul_goals_data = [
            {
                "title": "Achieve Q1 Sales Revenue Target",
                "thrust_area": ThrustArea.REVENUE_GROWTH,
                "uom_type": UoMType.MIN,
                "target_value": 5000000,
                "weightage": 30,
            },
            {
                "title": "Reduce Customer Response TAT",
                "thrust_area": ThrustArea.CUSTOMER_SATISFACTION,
                "uom_type": UoMType.MAX,
                "target_value": 2,
                "weightage": 25,
            },
            {
                "title": "Complete Product Certification Program",
                "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
                "uom_type": UoMType.TIMELINE,
                "target_date": date(2026, 6, 30),
                "weightage": 20,
            },
            {
                "title": "Zero Safety Incidents in Sales Field Visits",
                "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
                "uom_type": UoMType.ZERO,
                "target_value": 0,
                "weightage": 15,
            },
            {
                "title": "Onboard 3 New Enterprise Accounts",
                "thrust_area": ThrustArea.REVENUE_GROWTH,
                "uom_type": UoMType.MIN,
                "target_value": 3,
                "weightage": 10,
            },
        ]

        rahul_goals: list[Goal] = []
        for g in rahul_goals_data:
            goal = Goal(
                user_id=rahul.id,
                goal_sheet_id=rahul_sheet.id,
                cycle_id=cycle.id,
                status=GoalStatus.LOCKED,
                locked_at=locked_at,
                locked_by=vikram.id,
                **g,
            )
            session.add(goal)
            rahul_goals.append(goal)

        await session.flush()

        # GoalVersion snapshots (version 1 for each)
        for goal in rahul_goals:
            version = GoalVersion(
                goal_id=goal.id,
                version_number=1,
                title=goal.title,
                thrust_area=goal.thrust_area,
                uom_type=goal.uom_type,
                target_value=goal.target_value,
                target_date=goal.target_date,
                weightage=goal.weightage,
                status=goal.status,
                changed_by=rahul.id,
                snapshot_at=utc(2026, 5, 2, 10, 0, 0),
            )
            session.add(version)

        # GoalEvent: GOAL_LOCKED for each
        for goal in rahul_goals:
            event = GoalEvent(
                goal_id=goal.id,
                event_type=GoalEventType.GOAL_LOCKED,
                actor_id=vikram.id,
                occurred_at=locked_at,
            )
            session.add(event)

        await session.flush()

        # ── Step 5: Sneha — SUBMITTED sheet ───────────────────────────────────
        sneha_sheet = GoalSheet(
            user_id=sneha.id,
            cycle_id=cycle.id,
            status=GoalSheetStatus.SUBMITTED,
            submitted_at=utc(2026, 5, 5, 14, 30, 0),
        )
        session.add(sneha_sheet)
        await session.flush()

        sneha_goals_data = [
            {
                "title": "Q1 New Customer Acquisition",
                "thrust_area": ThrustArea.REVENUE_GROWTH,
                "uom_type": UoMType.MIN,
                "target_value": 10,
                "weightage": 35,
            },
            {
                "title": "Achieve NPS Score Target",
                "thrust_area": ThrustArea.CUSTOMER_SATISFACTION,
                "uom_type": UoMType.MIN,
                "target_value": 8,
                "weightage": 30,
            },
            {
                "title": "Reduce Sales Cycle Length",
                "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
                "uom_type": UoMType.MAX,
                "target_value": 14,
                "weightage": 25,
            },
            {
                "title": "Complete Sales Training Modules",
                "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
                "uom_type": UoMType.TIMELINE,
                "target_date": date(2026, 7, 31),
                "weightage": 10,
            },
        ]

        for g in sneha_goals_data:
            session.add(
                Goal(
                    user_id=sneha.id,
                    goal_sheet_id=sneha_sheet.id,
                    cycle_id=cycle.id,
                    status=GoalStatus.SUBMITTED,
                    **g,
                )
            )

        # ── Step 6: Arjun — DRAFT sheet (total weightage 90%, submit blocked) ─
        arjun_sheet = GoalSheet(
            user_id=arjun.id,
            cycle_id=cycle.id,
            status=GoalSheetStatus.DRAFT,
        )
        session.add(arjun_sheet)
        await session.flush()

        session.add_all(
            [
                Goal(
                    user_id=arjun.id,
                    goal_sheet_id=arjun_sheet.id,
                    cycle_id=cycle.id,
                    title="Improve Production Line Efficiency",
                    thrust_area=ThrustArea.OPERATIONAL_EXCELLENCE,
                    uom_type=UoMType.MIN,
                    target_value=95,
                    weightage=60,
                    status=GoalStatus.DRAFT,
                ),
                Goal(
                    user_id=arjun.id,
                    goal_sheet_id=arjun_sheet.id,
                    cycle_id=cycle.id,
                    title="Zero Quality Defects in Q1",
                    thrust_area=ThrustArea.QUALITY,
                    uom_type=UoMType.ZERO,
                    target_value=0,
                    weightage=30,
                    status=GoalStatus.DRAFT,
                ),
            ]
        )

        await session.flush()

        # ── Step 7: Audit log entries (10 entries) ─────────────────────────────
        audit_entries = [
            # 1. Rahul submitted his goal sheet
            AuditLog(
                table_name="goal_sheets",
                record_id=rahul_sheet.id,
                action=AuditAction.INSERT,
                actor_id=rahul.id,
                actor_role=UserRole.EMPLOYEE,
                changed_at=utc(2026, 5, 2, 10, 0, 0),
            ),
            # 2-4. Three of Rahul's goals approved by Vikram
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[0].id,
                action=AuditAction.UPDATE,
                field_name="status",
                old_value="submitted",
                new_value="approved",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=utc(2026, 5, 3, 9, 0, 0),
            ),
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[1].id,
                action=AuditAction.UPDATE,
                field_name="status",
                old_value="submitted",
                new_value="approved",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=utc(2026, 5, 3, 9, 5, 0),
            ),
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[2].id,
                action=AuditAction.UPDATE,
                field_name="status",
                old_value="submitted",
                new_value="approved",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=utc(2026, 5, 3, 9, 10, 0),
            ),
            # 5. Vikram edited Rahul's goal 1 target
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[0].id,
                action=AuditAction.UPDATE,
                field_name="target_value",
                old_value="4500000",
                new_value="5000000",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=utc(2026, 5, 3, 10, 0, 0),
            ),
            # 6-8. Three goals locked
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[0].id,
                action=AuditAction.UPDATE,
                field_name="status",
                old_value="approved",
                new_value="locked",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=locked_at,
            ),
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[1].id,
                action=AuditAction.UPDATE,
                field_name="status",
                old_value="approved",
                new_value="locked",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=locked_at,
            ),
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[2].id,
                action=AuditAction.UPDATE,
                field_name="status",
                old_value="approved",
                new_value="locked",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=locked_at,
            ),
            # 9. Rahul's goal 4 approved
            AuditLog(
                table_name="goals",
                record_id=rahul_goals[3].id,
                action=AuditAction.UPDATE,
                field_name="status",
                old_value="submitted",
                new_value="approved",
                actor_id=vikram.id,
                actor_role=UserRole.MANAGER,
                changed_at=utc(2026, 5, 3, 9, 15, 0),
            ),
            # 10. Sneha submitted her goal sheet
            AuditLog(
                table_name="goal_sheets",
                record_id=sneha_sheet.id,
                action=AuditAction.INSERT,
                actor_id=sneha.id,
                actor_role=UserRole.EMPLOYEE,
                changed_at=utc(2026, 5, 5, 14, 30, 0),
            ),
        ]
        session.add_all(audit_entries)

        # ── Step 8: Notifications ─────────────────────────────────────────────
        notifications = [
            Notification(
                recipient_id=vikram.id,
                notification_type=NotificationType.GOAL_SUBMITTED,
                title="Goal Sheet Submitted",
                body="Sneha Patel has submitted her goal sheet for review.",
                is_read=False,
                related_goal_id=None,
            ),
            Notification(
                recipient_id=rahul.id,
                notification_type=NotificationType.GOAL_APPROVED,
                title="Goal Sheet Approved",
                body="Your goal sheet has been approved by Vikram Nair.",
                is_read=True,
                read_at=utc(2026, 5, 4, 12, 0, 0),
                related_goal_id=rahul_goals[0].id,
            ),
            Notification(
                recipient_id=vikram.id,
                notification_type=NotificationType.WINDOW_OPENING,
                title="Goals Not Submitted",
                body="Arjun Mehta has not submitted goals — 12 days since window opened.",
                is_read=False,
                related_goal_id=None,
            ),
        ]
        session.add_all(notifications)

        await session.commit()

        # ── Summary ────────────────────────────────────────────────────────────
        user_count = 7
        goal_count = len(rahul_goals) + len(sneha_goals_data) + 2
        audit_count = len(audit_entries)
        print(
            f"Seed complete. Created {user_count} users, {goal_count} goals, "
            f"{audit_count} audit entries."
        )


if __name__ == "__main__":
    asyncio.run(main())
