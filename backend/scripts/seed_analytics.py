"""
Analytics seed script — populates FY2025 historical data (complete) and
FY2026 Q1 partial data for the analytics module.

The active FY2026 Q1 cycle is left untouched.
All analytics data is keyed to the GOAL_SETTING cycle of each fiscal year
so the analytics API (which queries by cycle_id) works correctly.

Run from backend/ directory:
    python scripts/seed_analytics.py
"""
from __future__ import annotations

import asyncio
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.constants import (
    AchievementStatus,
    CheckinCommentType,
    CheckinRatingSentiment,
    CyclePhase,
    GoalSheetStatus,
    GoalStatus,
    Quarter,
    ThrustArea,
    UoMType,
    UserRole,
)
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models import (
    Achievement,
    AnalyticsSnapshot,
    Checkin,
    CycleConfig,
    Department,
    Goal,
    GoalSheet,
    User,
)

_PW_MANAGER = "Manager@1234"
_PW_EMPLOYEE = "Employee@1234"


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


async def get_user(session, email: str) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise RuntimeError(f"User not found: {email}. Run seed_data.py first.")
    return user


async def get_or_create_user(session, email: str, **kwargs) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email, **kwargs)
        session.add(user)
        await session.flush()
    return user


async def get_dept(session, name: str) -> Department:
    result = await session.execute(select(Department).where(Department.name == name))
    dept = result.scalar_one_or_none()
    if dept is None:
        raise RuntimeError(f"Department not found: {name}. Run seed_data.py first.")
    return dept


# ─── Goal templates per employee profile ─────────────────────────────────────

GOAL_TEMPLATES: dict[str, list[dict]] = {
    "sales_senior": [
        {
            "title": "Achieve Annual Revenue Target — Zone West",
            "thrust_area": ThrustArea.REVENUE_GROWTH,
            "uom_type": UoMType.MIN,
            "target_value": 8000000,
            "weightage": 35,
        },
        {
            "title": "Maintain Customer Retention Rate Above 90%",
            "thrust_area": ThrustArea.CUSTOMER_SATISFACTION,
            "uom_type": UoMType.MIN,
            "target_value": 90,
            "weightage": 25,
        },
        {
            "title": "Reduce Average Sales Cycle to 10 Days",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MAX,
            "target_value": 10,
            "weightage": 20,
        },
        {
            "title": "Complete Advanced Sales Leadership Certification",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2025, 12, 31),
            "weightage": 10,
        },
        {
            "title": "Zero Non-Compliance Incidents in Field Visits",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 10,
        },
    ],
    "sales_junior": [
        {
            "title": "Meet Quarterly Sales Quota",
            "thrust_area": ThrustArea.REVENUE_GROWTH,
            "uom_type": UoMType.MIN,
            "target_value": 3000000,
            "weightage": 35,
        },
        {
            "title": "Improve CSAT Score to 4.2 / 5",
            "thrust_area": ThrustArea.CUSTOMER_SATISFACTION,
            "uom_type": UoMType.MIN,
            "target_value": 4.2,
            "weightage": 25,
        },
        {
            "title": "Attend All Weekly Pipeline Reviews",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 48,
            "weightage": 20,
        },
        {
            "title": "Complete Product Mastery Training Program",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2025, 9, 30),
            "weightage": 10,
        },
        {
            "title": "Zero CRM Data Policy Violations",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 10,
        },
    ],
    "ops_senior": [
        {
            "title": "Achieve 98% On-Time Delivery Rate",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 98,
            "weightage": 35,
        },
        {
            "title": "Reduce Defect Rate Below 0.5%",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.MAX,
            "target_value": 0.5,
            "weightage": 30,
        },
        {
            "title": "Reduce Operational Cost Base by 8%",
            "thrust_area": ThrustArea.COST_OPTIMISATION,
            "uom_type": UoMType.MIN,
            "target_value": 8,
            "weightage": 20,
        },
        {
            "title": "Complete ISO 9001 Audit Preparation",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2025, 11, 30),
            "weightage": 10,
        },
        {
            "title": "Mentor 3 Junior Staff on ERP System",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.MIN,
            "target_value": 3,
            "weightage": 5,
        },
    ],
    "ops_junior": [
        {
            "title": "Maintain Daily Production Targets at 95%+",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 95,
            "weightage": 40,
        },
        {
            "title": "Reduce Rework Rate to Under 2%",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.MAX,
            "target_value": 2,
            "weightage": 25,
        },
        {
            "title": "Zero Safety Incidents on Production Floor",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 20,
        },
        {
            "title": "Identify and Implement 2 Cost-Saving Initiatives",
            "thrust_area": ThrustArea.COST_OPTIMISATION,
            "uom_type": UoMType.MIN,
            "target_value": 2,
            "weightage": 10,
        },
        {
            "title": "Complete Lean Six Sigma Green Belt Training",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2025, 8, 31),
            "weightage": 5,
        },
    ],
    "eng_senior": [
        {
            "title": "Ship 3 Major Product Features to Production",
            "thrust_area": ThrustArea.INNOVATION,
            "uom_type": UoMType.MIN,
            "target_value": 3,
            "weightage": 35,
        },
        {
            "title": "Maintain System Uptime Above 99.9%",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.MIN,
            "target_value": 99.9,
            "weightage": 25,
        },
        {
            "title": "Complete Cloud Infrastructure Migration Phase 1",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2025, 10, 31),
            "weightage": 20,
        },
        {
            "title": "Reduce AWS Infrastructure Cost by 15%",
            "thrust_area": ThrustArea.COST_OPTIMISATION,
            "uom_type": UoMType.MIN,
            "target_value": 15,
            "weightage": 10,
        },
        {
            "title": "Earn AWS Solutions Architect Professional Cert",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2025, 12, 31),
            "weightage": 10,
        },
    ],
    "eng_junior": [
        {
            "title": "Deliver Sprint Commitments at 95%+ Velocity",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 95,
            "weightage": 35,
        },
        {
            "title": "Maintain Test Coverage Above 80%",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.MIN,
            "target_value": 80,
            "weightage": 25,
        },
        {
            "title": "Build and Demo 1 Internal Innovation POC",
            "thrust_area": ThrustArea.INNOVATION,
            "uom_type": UoMType.MIN,
            "target_value": 1,
            "weightage": 20,
        },
        {
            "title": "Zero Critical Bugs Escaped to Production",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 10,
        },
        {
            "title": "Complete System Design Fundamentals Course",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2025, 7, 31),
            "weightage": 10,
        },
    ],
}

# FY2026 goal templates (same structure, just different target_dates)
GOAL_TEMPLATES_FY26: dict[str, list[dict]] = {
    "sales_senior": [
        {
            "title": "Surpass FY2026 Revenue Plan — Zone West",
            "thrust_area": ThrustArea.REVENUE_GROWTH,
            "uom_type": UoMType.MIN,
            "target_value": 9500000,
            "weightage": 35,
        },
        {
            "title": "Grow Enterprise Account Base by 20%",
            "thrust_area": ThrustArea.CUSTOMER_SATISFACTION,
            "uom_type": UoMType.MIN,
            "target_value": 20,
            "weightage": 25,
        },
        {
            "title": "Implement Account-Based Selling Framework",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2026, 8, 31),
            "weightage": 20,
        },
        {
            "title": "Coach 2 Junior Sales Reps to Target Achievement",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.MIN,
            "target_value": 2,
            "weightage": 10,
        },
        {
            "title": "Zero Regulatory Non-Compliance Events",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 10,
        },
    ],
    "sales_junior": [
        {
            "title": "Exceed Q1 Revenue Quota by 10%",
            "thrust_area": ThrustArea.REVENUE_GROWTH,
            "uom_type": UoMType.MIN,
            "target_value": 3300000,
            "weightage": 35,
        },
        {
            "title": "Improve Customer Satisfaction Score to 4.5",
            "thrust_area": ThrustArea.CUSTOMER_SATISFACTION,
            "uom_type": UoMType.MIN,
            "target_value": 4.5,
            "weightage": 25,
        },
        {
            "title": "Maintain Full CRM Pipeline Hygiene",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 50,
            "weightage": 20,
        },
        {
            "title": "Complete Challenger Sale Methodology Training",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2026, 7, 31),
            "weightage": 10,
        },
        {
            "title": "Zero GDPR / Data Handling Violations",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 10,
        },
    ],
    "ops_senior": [
        {
            "title": "Drive On-Time Delivery Rate to 99%",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 99,
            "weightage": 35,
        },
        {
            "title": "Achieve Near-Zero Defect Rate (< 0.3%)",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.MAX,
            "target_value": 0.3,
            "weightage": 30,
        },
        {
            "title": "Reduce Supply Chain Overheads by 10%",
            "thrust_area": ThrustArea.COST_OPTIMISATION,
            "uom_type": UoMType.MIN,
            "target_value": 10,
            "weightage": 20,
        },
        {
            "title": "Lead ERP Upgrade Rollout for Ops Team",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2026, 9, 30),
            "weightage": 10,
        },
        {
            "title": "Mentor 4 Junior Ops Staff on New Processes",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.MIN,
            "target_value": 4,
            "weightage": 5,
        },
    ],
    "ops_junior": [
        {
            "title": "Meet All Production Milestones in Q1",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 100,
            "weightage": 40,
        },
        {
            "title": "Keep Rework Rate Below 1.5%",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.MAX,
            "target_value": 1.5,
            "weightage": 25,
        },
        {
            "title": "Maintain Zero Safety Incidents",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 20,
        },
        {
            "title": "Submit 3 Process Improvement Proposals",
            "thrust_area": ThrustArea.COST_OPTIMISATION,
            "uom_type": UoMType.MIN,
            "target_value": 3,
            "weightage": 10,
        },
        {
            "title": "Achieve Lean Manufacturing Yellow Belt",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2026, 8, 31),
            "weightage": 5,
        },
    ],
    "eng_senior": [
        {
            "title": "Deliver FY2026 Roadmap Feature Set (Q1–Q2)",
            "thrust_area": ThrustArea.INNOVATION,
            "uom_type": UoMType.MIN,
            "target_value": 4,
            "weightage": 35,
        },
        {
            "title": "Keep P0 Incident Count at Zero",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 25,
        },
        {
            "title": "Complete Kubernetes Platform Migration",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2026, 9, 30),
            "weightage": 20,
        },
        {
            "title": "Reduce Cloud Spend by 20% via Reserved Instances",
            "thrust_area": ThrustArea.COST_OPTIMISATION,
            "uom_type": UoMType.MIN,
            "target_value": 20,
            "weightage": 10,
        },
        {
            "title": "Run 2 Internal Tech Talks / Knowledge Sessions",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.MIN,
            "target_value": 2,
            "weightage": 10,
        },
    ],
    "eng_junior": [
        {
            "title": "Close All Assigned Tickets at 95%+ On-Time Rate",
            "thrust_area": ThrustArea.OPERATIONAL_EXCELLENCE,
            "uom_type": UoMType.MIN,
            "target_value": 95,
            "weightage": 35,
        },
        {
            "title": "Increase Unit Test Coverage to 85%",
            "thrust_area": ThrustArea.QUALITY,
            "uom_type": UoMType.MIN,
            "target_value": 85,
            "weightage": 25,
        },
        {
            "title": "Prototype 1 AI-Assisted Internal Tool",
            "thrust_area": ThrustArea.INNOVATION,
            "uom_type": UoMType.MIN,
            "target_value": 1,
            "weightage": 20,
        },
        {
            "title": "Zero Security Vulnerabilities in Owned Modules",
            "thrust_area": ThrustArea.SAFETY_COMPLIANCE,
            "uom_type": UoMType.ZERO,
            "target_value": 0,
            "weightage": 10,
        },
        {
            "title": "Complete Cloud Practitioner Certification",
            "thrust_area": ThrustArea.PEOPLE_DEVELOPMENT,
            "uom_type": UoMType.TIMELINE,
            "target_date": date(2026, 7, 31),
            "weightage": 10,
        },
    ],
}


async def main() -> None:
    async with AsyncSessionLocal() as session:

        # ── Fetch existing base data ───────────────────────────────────────────
        dept_sales = await get_dept(session, "Sales Department")
        dept_ops = await get_dept(session, "Operations Department")
        dept_eng = await get_dept(session, "Engineering Department")

        priya = await get_user(session, "priya@atomberg.com")
        vikram = await get_user(session, "vikram@atomberg.com")
        kavya = await get_user(session, "kavya@atomberg.com")
        rahul = await get_user(session, "rahul@atomberg.com")
        sneha = await get_user(session, "sneha@atomberg.com")
        arjun = await get_user(session, "arjun@atomberg.com")
        divya = await get_user(session, "divya@atomberg.com")

        # ── Create additional manager: Engineering ─────────────────────────────
        rohit = await get_or_create_user(
            session,
            "rohit@atomberg.com",
            hashed_password=hash_password(_PW_MANAGER),
            full_name="Rohit Kapoor",
            role=UserRole.MANAGER,
            department_id=dept_eng.id,
            employee_code="AT-M00004",
            manager_id=priya.id,
        )

        # ── Create additional employees ────────────────────────────────────────
        # Sales — 2 more under Vikram
        aakash = await get_or_create_user(
            session,
            "aakash@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Aakash Gupta",
            role=UserRole.EMPLOYEE,
            department_id=dept_sales.id,
            employee_code="AT-E00006",
            manager_id=vikram.id,
        )
        priya_t = await get_or_create_user(
            session,
            "priyat@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Priya Tiwari",
            role=UserRole.EMPLOYEE,
            department_id=dept_sales.id,
            employee_code="AT-E00007",
            manager_id=vikram.id,
        )
        # Operations — 2 more under Kavya
        siddharth = await get_or_create_user(
            session,
            "siddharth@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Siddharth Roy",
            role=UserRole.EMPLOYEE,
            department_id=dept_ops.id,
            employee_code="AT-E00008",
            manager_id=kavya.id,
        )
        ananya = await get_or_create_user(
            session,
            "ananya@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Ananya Krishnan",
            role=UserRole.EMPLOYEE,
            department_id=dept_ops.id,
            employee_code="AT-E00009",
            manager_id=kavya.id,
        )
        # Engineering — 4 under Rohit
        aditya = await get_or_create_user(
            session,
            "aditya@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Aditya Sharma",
            role=UserRole.EMPLOYEE,
            department_id=dept_eng.id,
            employee_code="AT-E00010",
            manager_id=rohit.id,
        )
        neha = await get_or_create_user(
            session,
            "neha@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Neha Joshi",
            role=UserRole.EMPLOYEE,
            department_id=dept_eng.id,
            employee_code="AT-E00011",
            manager_id=rohit.id,
        )
        karan = await get_or_create_user(
            session,
            "karan@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Karan Malhotra",
            role=UserRole.EMPLOYEE,
            department_id=dept_eng.id,
            employee_code="AT-E00012",
            manager_id=rohit.id,
        )
        tanvi = await get_or_create_user(
            session,
            "tanvi@atomberg.com",
            hashed_password=hash_password(_PW_EMPLOYEE),
            full_name="Tanvi Desai",
            role=UserRole.EMPLOYEE,
            department_id=dept_eng.id,
            employee_code="AT-E00013",
            manager_id=rohit.id,
        )

        await session.flush()

        # ── Idempotency check — skip if FY2025 already seeded ────────────────
        existing_fy25 = (
            await session.execute(
                select(CycleConfig)
                .where(CycleConfig.cycle_name == "FY2025")
                .where(CycleConfig.phase == CyclePhase.GOAL_SETTING)
            )
        ).scalar_one_or_none()

        if existing_fy25:
            print("FY2025 GOAL_SETTING cycle already exists — skipping FY2025 seed.")
        else:
            await _seed_fy2025(
                session,
                priya=priya,
                vikram=vikram, kavya=kavya, rohit=rohit,
                rahul=rahul, sneha=sneha, aakash=aakash, priya_t=priya_t,
                arjun=arjun, divya=divya, siddharth=siddharth, ananya=ananya,
                aditya=aditya, neha=neha, karan=karan, tanvi=tanvi,
                dept_sales=dept_sales, dept_ops=dept_ops, dept_eng=dept_eng,
            )

        # ── FY2026 partial Q1 data for NEW employees ──────────────────────────
        # Find existing FY2026 GOAL_SETTING cycle (created by seed_data.py)
        # cycle_name may be "FY2026" or "FY2026 Goals Setting" depending on seed
        fy26_gs = (
            await session.execute(
                select(CycleConfig)
                .where(CycleConfig.cycle_name.like("FY2026%"))
                .where(CycleConfig.phase == CyclePhase.GOAL_SETTING)
            )
        ).scalar_one_or_none()

        if fy26_gs is None:
            print("FY2026 GOAL_SETTING cycle not found — skipping FY2026 partial seed. Run seed_data.py first.")
        else:
            await _seed_fy2026_partial(
                session,
                fy26_gs=fy26_gs,
                vikram=vikram, kavya=kavya, rohit=rohit,
                aakash=aakash, priya_t=priya_t,
                arjun=arjun, divya=divya, siddharth=siddharth, ananya=ananya,
                aditya=aditya, neha=neha, karan=karan, tanvi=tanvi,
                dept_sales=dept_sales, dept_ops=dept_ops, dept_eng=dept_eng,
            )

        await session.commit()
        print("Analytics seed complete.")


# ─── FY2025 — complete 4-quarter historical data ──────────────────────────────

async def _seed_fy2025(
    session,
    *,
    priya, vikram, kavya, rohit,
    rahul, sneha, aakash, priya_t,
    arjun, divya, siddharth, ananya,
    aditya, neha, karan, tanvi,
    dept_sales, dept_ops, dept_eng,
) -> None:
    print("Seeding FY2025 data...")

    # ── FY2025 cycle configs ───────────────────────────────────────────────────
    cy25 = CycleConfig(
        cycle_name="FY2025",
        phase=CyclePhase.GOAL_SETTING,
        window_open=utc(2025, 4, 1, 0, 0, 0),
        window_close=utc(2025, 4, 30, 23, 59, 59),
        is_active=False,
        created_by=priya.id,
    )
    cy25_q1 = CycleConfig(
        cycle_name="FY2025",
        phase=CyclePhase.Q1,
        window_open=utc(2025, 5, 1, 0, 0, 0),
        window_close=utc(2025, 7, 31, 23, 59, 59),
        is_active=False,
        created_by=priya.id,
    )
    cy25_q2 = CycleConfig(
        cycle_name="FY2025",
        phase=CyclePhase.Q2,
        window_open=utc(2025, 8, 1, 0, 0, 0),
        window_close=utc(2025, 10, 31, 23, 59, 59),
        is_active=False,
        created_by=priya.id,
    )
    cy25_q3 = CycleConfig(
        cycle_name="FY2025",
        phase=CyclePhase.Q3,
        window_open=utc(2025, 11, 1, 0, 0, 0),
        window_close=utc(2026, 1, 31, 23, 59, 59),
        is_active=False,
        created_by=priya.id,
    )
    cy25_q4 = CycleConfig(
        cycle_name="FY2025",
        phase=CyclePhase.Q4,
        window_open=utc(2026, 2, 1, 0, 0, 0),
        window_close=utc(2026, 4, 30, 23, 59, 59),
        is_active=False,
        created_by=priya.id,
    )
    session.add_all([cy25, cy25_q1, cy25_q2, cy25_q3, cy25_q4])
    await session.flush()

    # Per-quarter metadata: (quarter_enum, quarter_cycle, actual_date_for_timeline,
    #                         achievement_submitted_at, checkin_completed_at, acknowledged_at)
    Q_META = [
        (Quarter.Q1, cy25_q1, date(2025, 6, 25),
         utc(2025, 7, 28, 10, 0, 0), utc(2025, 8, 10, 14, 0, 0), utc(2025, 8, 12, 10, 0, 0)),
        (Quarter.Q2, cy25_q2, date(2025, 9, 25),
         utc(2025, 10, 28, 10, 0, 0), utc(2025, 11, 10, 14, 0, 0), utc(2025, 11, 12, 10, 0, 0)),
        (Quarter.Q3, cy25_q3, date(2025, 12, 20),
         utc(2026, 1, 25, 10, 0, 0), utc(2026, 2, 8, 14, 0, 0), utc(2026, 2, 10, 10, 0, 0)),
        (Quarter.Q4, cy25_q4, date(2026, 3, 25),
         utc(2026, 4, 25, 10, 0, 0), utc(2026, 4, 27, 14, 0, 0), utc(2026, 4, 28, 10, 0, 0)),
    ]

    # Per-employee quarterly scores — realistic story:
    #   Sales: strong Q1, notable Q2 dip (market headwinds), recovery Q3, strong close Q4
    #   Ops:   steady improvement quarter over quarter throughout FY2025
    #   Eng:   consistently high performance with slight mid-year dip
    EMP_SCORES: dict[str, list[float]] = {
        rahul.email:     [82.0, 70.0, 86.0, 91.0],
        sneha.email:     [72.0, 64.0, 76.0, 83.0],
        aakash.email:    [67.0, 59.0, 72.0, 78.0],
        priya_t.email:   [74.0, 68.0, 77.0, 84.0],
        arjun.email:     [79.0, 83.0, 86.0, 90.0],
        divya.email:     [71.0, 75.0, 80.0, 85.0],
        siddharth.email: [68.0, 73.0, 77.0, 82.0],
        ananya.email:    [76.0, 80.0, 84.0, 88.0],
        aditya.email:    [89.0, 91.0, 88.0, 94.0],
        neha.email:      [79.0, 83.0, 87.0, 90.0],
        karan.email:     [74.0, 77.0, 82.0, 86.0],
        tanvi.email:     [81.0, 85.0, 88.0, 92.0],
    }

    # Checkin coverage per (manager, quarter_index):
    #   Vikram = 100% — all employees, all quarters
    #   Kavya  = 87.5% — misses Siddharth Q2, Ananya Q3
    #   Rohit  = 75%  — misses Karan Q2+Q4, Tanvi Q2
    CHECKIN_SKIP: set[tuple] = {
        (kavya.id, siddharth.id, 1),   # Kavya skips Siddharth Q2
        (kavya.id, ananya.id, 2),      # Kavya skips Ananya Q3
        (rohit.id, karan.id, 1),       # Rohit skips Karan Q2
        (rohit.id, karan.id, 3),       # Rohit skips Karan Q4
        (rohit.id, tanvi.id, 1),       # Rohit skips Tanvi Q2
    }

    PROFILE_MAP = {
        rahul.email:     ("sales_senior", vikram, dept_sales),
        sneha.email:     ("sales_junior", vikram, dept_sales),
        aakash.email:    ("sales_junior", vikram, dept_sales),
        priya_t.email:   ("sales_junior", vikram, dept_sales),
        arjun.email:     ("ops_senior",   kavya,  dept_ops),
        divya.email:     ("ops_junior",   kavya,  dept_ops),
        siddharth.email: ("ops_junior",   kavya,  dept_ops),
        ananya.email:    ("ops_junior",   kavya,  dept_ops),
        aditya.email:    ("eng_senior",   rohit,  dept_eng),
        neha.email:      ("eng_junior",   rohit,  dept_eng),
        karan.email:     ("eng_junior",   rohit,  dept_eng),
        tanvi.email:     ("eng_junior",   rohit,  dept_eng),
    }

    goal_setting_locked_at = utc(2025, 4, 28, 18, 0, 0)
    goal_sheet_submitted = utc(2025, 4, 15, 10, 0, 0)

    for emp_email, (profile, mgr, dept) in PROFILE_MAP.items():
        emp_result = await session.execute(select(User).where(User.email == emp_email))
        emp = emp_result.scalar_one()

        # Goal sheet (FY2025 GOAL_SETTING cycle)
        gs = GoalSheet(
            user_id=emp.id,
            cycle_id=cy25.id,
            status=GoalSheetStatus.APPROVED,
            submitted_at=goal_sheet_submitted,
            approved_at=utc(2025, 4, 26, 9, 0, 0),
            approved_by=mgr.id,
        )
        session.add(gs)
        await session.flush()

        # Goals
        goals: list[Goal] = []
        for g_data in GOAL_TEMPLATES[profile]:
            g = Goal(
                user_id=emp.id,
                goal_sheet_id=gs.id,
                cycle_id=cy25.id,
                status=GoalStatus.LOCKED,
                locked_at=goal_setting_locked_at,
                locked_by=mgr.id,
                **g_data,
            )
            session.add(g)
            goals.append(g)
        await session.flush()

        scores = EMP_SCORES[emp_email]

        for qi, (qtr, qcy, actual_date, ach_submitted_at, checkin_at, acked_at) in enumerate(Q_META):
            score = scores[qi]

            # Achievements for each goal
            for goal in goals:
                if goal.uom_type == UoMType.TIMELINE:
                    ach = Achievement(
                        goal_id=goal.id,
                        quarter=qtr,
                        actual_date=actual_date,
                        status=AchievementStatus.COMPLETED,
                        computed_score=Decimal(str(score)),
                        score_formula_used="timeline_scoring",
                        submitted_at=ach_submitted_at,
                        submitted_by=emp.id,
                    )
                elif goal.uom_type == UoMType.ZERO:
                    ach = Achievement(
                        goal_id=goal.id,
                        quarter=qtr,
                        actual_value=Decimal("0"),
                        status=AchievementStatus.COMPLETED,
                        computed_score=Decimal("100.0"),
                        score_formula_used="zero_scoring",
                        submitted_at=ach_submitted_at,
                        submitted_by=emp.id,
                    )
                else:
                    tv = float(goal.target_value or 0)
                    pct = score / 100.0
                    ach = Achievement(
                        goal_id=goal.id,
                        quarter=qtr,
                        actual_value=Decimal(str(round(tv * pct, 2))),
                        status=AchievementStatus.COMPLETED,
                        computed_score=Decimal(str(score)),
                        score_formula_used="min_max_scoring",
                        submitted_at=ach_submitted_at,
                        submitted_by=emp.id,
                    )
                session.add(ach)

            # Checkin (with selective skips for realistic manager coverage)
            do_checkin = (mgr.id, emp.id, qi) not in CHECKIN_SKIP
            if do_checkin:
                if score >= 85:
                    comment = (
                        f"{emp.full_name} has delivered outstanding results this quarter. "
                        f"Targets exceeded across key metrics. Strong cross-functional collaboration "
                        f"and consistent ownership of deliverables. Keep up the excellent momentum."
                    )
                    sentiment = CheckinRatingSentiment.POSITIVE
                elif score >= 70:
                    comment = (
                        f"{emp.full_name} is progressing well and is broadly on track. "
                        f"Some areas — particularly execution consistency — need focus. "
                        f"Action plan discussed and agreed upon. Confident about the next quarter."
                    )
                    sentiment = CheckinRatingSentiment.NEUTRAL
                else:
                    comment = (
                        f"{emp.full_name} has had a challenging quarter with performance below expectations. "
                        f"Key targets were missed due to external headwinds and some execution gaps. "
                        f"A structured performance improvement plan has been initiated."
                    )
                    sentiment = CheckinRatingSentiment.NEEDS_ATTENTION

                checkin = Checkin(
                    manager_id=mgr.id,
                    employee_id=emp.id,
                    quarter=qtr,
                    cycle_id=cy25.id,
                    comment=comment,
                    comment_type=CheckinCommentType.STRUCTURED,
                    overall_rating_sentiment=sentiment,
                    completed_at=checkin_at,
                    is_acknowledged_by_employee=True,
                    acknowledged_at=acked_at,
                )
                session.add(checkin)

            await session.flush()

            # Analytics snapshot (pre-computed projection)
            snapshot = AnalyticsSnapshot(
                user_id=emp.id,
                quarter=qtr,
                cycle_id=cy25.id,
                manager_id=mgr.id,
                department_id=dept.id,
                weighted_score=Decimal(str(score)),
                goals_total=len(goals),
                goals_submitted=len(goals),
                goals_completed=len(goals),
                checkin_done=do_checkin,
                achievement_submitted=True,
            )
            session.add(snapshot)

    await session.flush()
    print("  FY2025 seed complete — 12 employees x 4 quarters.")


# ─── FY2026 — partial Q1 data for new employees ──────────────────────────────

async def _seed_fy2026_partial(
    session,
    *,
    fy26_gs,
    vikram, kavya, rohit,
    aakash, priya_t,
    arjun, divya, siddharth, ananya,
    aditya, neha, karan, tanvi,
    dept_sales, dept_ops, dept_eng,
) -> None:
    print("Seeding FY2026 Q1 partial data for new employees...")

    goal_locked_at = utc(2026, 5, 4, 11, 0, 0)
    gs_submitted = utc(2026, 5, 3, 10, 0, 0)
    gs_approved_at = utc(2026, 5, 4, 9, 0, 0)

    # Per-employee Q1 partial scores (in progress — mid-quarter)
    FY26_SCORES: dict[str, float | None] = {
        aakash.email:    73.0,
        priya_t.email:   78.0,
        arjun.email:     81.0,
        divya.email:     75.0,
        siddharth.email: 70.0,
        ananya.email:    79.0,
        aditya.email:    88.0,
        neha.email:      82.0,
        karan.email:     None,   # not yet submitted — goal locked, no achievement
        tanvi.email:     84.0,
    }

    # Checkin coverage for FY2026 Q1 (Rohit skips Karan, consistent with FY2025 pattern)
    FY26_CHECKIN_SKIP: set[tuple] = {
        (rohit.id, karan.id),
    }

    PROFILE_MAP_FY26 = {
        aakash.email:    ("sales_junior", vikram, dept_sales),
        priya_t.email:   ("sales_junior", vikram, dept_sales),
        arjun.email:     ("ops_senior",   kavya,  dept_ops),
        divya.email:     ("ops_junior",   kavya,  dept_ops),
        siddharth.email: ("ops_junior",   kavya,  dept_ops),
        ananya.email:    ("ops_junior",   kavya,  dept_ops),
        aditya.email:    ("eng_senior",   rohit,  dept_eng),
        neha.email:      ("eng_junior",   rohit,  dept_eng),
        karan.email:     ("eng_junior",   rohit,  dept_eng),
        tanvi.email:     ("eng_junior",   rohit,  dept_eng),
    }

    for emp_email, (profile, mgr, dept) in PROFILE_MAP_FY26.items():
        emp_result = await session.execute(select(User).where(User.email == emp_email))
        emp = emp_result.scalar_one()

        # Check if goal sheet already exists for this employee in FY2026 GOAL_SETTING
        existing_gs = (
            await session.execute(
                select(GoalSheet)
                .where(GoalSheet.user_id == emp.id)
                .where(GoalSheet.cycle_id == fy26_gs.id)
            )
        ).scalar_one_or_none()

        if existing_gs:
            continue  # skip if already has a goal sheet for FY2026

        gs = GoalSheet(
            user_id=emp.id,
            cycle_id=fy26_gs.id,
            status=GoalSheetStatus.APPROVED,
            submitted_at=gs_submitted,
            approved_at=gs_approved_at,
            approved_by=mgr.id,
        )
        session.add(gs)
        await session.flush()

        goals: list[Goal] = []
        for g_data in GOAL_TEMPLATES_FY26[profile]:
            g = Goal(
                user_id=emp.id,
                goal_sheet_id=gs.id,
                cycle_id=fy26_gs.id,
                status=GoalStatus.LOCKED,
                locked_at=goal_locked_at,
                locked_by=mgr.id,
                **g_data,
            )
            session.add(g)
            goals.append(g)
        await session.flush()

        score = FY26_SCORES[emp_email]
        ach_submitted_at = utc(2026, 5, 18, 10, 0, 0)

        # Achievements (only if score is not None)
        if score is not None:
            for goal in goals:
                if goal.uom_type == UoMType.TIMELINE:
                    ach = Achievement(
                        goal_id=goal.id,
                        quarter=Quarter.Q1,
                        actual_date=date(2026, 5, 15),
                        status=AchievementStatus.ON_TRACK,
                        computed_score=Decimal(str(score)),
                        score_formula_used="timeline_scoring",
                        submitted_at=ach_submitted_at,
                        submitted_by=emp.id,
                    )
                elif goal.uom_type == UoMType.ZERO:
                    ach = Achievement(
                        goal_id=goal.id,
                        quarter=Quarter.Q1,
                        actual_value=Decimal("0"),
                        status=AchievementStatus.ON_TRACK,
                        computed_score=Decimal("100.0"),
                        score_formula_used="zero_scoring",
                        submitted_at=ach_submitted_at,
                        submitted_by=emp.id,
                    )
                else:
                    tv = float(goal.target_value or 0)
                    pct = score / 100.0
                    ach = Achievement(
                        goal_id=goal.id,
                        quarter=Quarter.Q1,
                        actual_value=Decimal(str(round(tv * pct, 2))),
                        status=AchievementStatus.ON_TRACK,
                        computed_score=Decimal(str(score)),
                        score_formula_used="min_max_scoring",
                        submitted_at=ach_submitted_at,
                        submitted_by=emp.id,
                    )
                session.add(ach)

        # Checkin for Q1 (selective)
        do_checkin = (mgr.id, emp.id) not in FY26_CHECKIN_SKIP
        if do_checkin:
            if score is not None and score >= 80:
                comment = (
                    f"{emp.full_name} is off to a strong start in FY2026. "
                    f"Q1 execution has been solid across all core areas. "
                    f"Keeping a close eye on stretch targets — optimistic about full-year delivery."
                )
                sentiment = CheckinRatingSentiment.POSITIVE
            else:
                comment = (
                    f"{emp.full_name} is settling into FY2026 objectives. "
                    f"Q1 progress is moderate; a few goals need more focused attention. "
                    f"Agreed on bi-weekly syncs to stay on course."
                )
                sentiment = CheckinRatingSentiment.NEUTRAL

            checkin = Checkin(
                manager_id=mgr.id,
                employee_id=emp.id,
                quarter=Quarter.Q1,
                cycle_id=fy26_gs.id,
                comment=comment,
                comment_type=CheckinCommentType.STRUCTURED,
                overall_rating_sentiment=sentiment,
                completed_at=utc(2026, 5, 19, 14, 0, 0),
                is_acknowledged_by_employee=False,
            )
            session.add(checkin)

        await session.flush()

        # Analytics snapshot for FY2026 Q1
        snapshot = AnalyticsSnapshot(
            user_id=emp.id,
            quarter=Quarter.Q1,
            cycle_id=fy26_gs.id,
            manager_id=mgr.id,
            department_id=dept.id,
            weighted_score=Decimal(str(score)) if score is not None else None,
            goals_total=len(goals),
            goals_submitted=len(goals) if score is not None else 0,
            goals_completed=0,
            checkin_done=do_checkin,
            achievement_submitted=score is not None,
        )
        session.add(snapshot)

    await session.flush()
    print("  FY2026 Q1 partial seed complete — 10 new employees.")


if __name__ == "__main__":
    asyncio.run(main())
