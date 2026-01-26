"""
VPN Subscriptions API endpoints.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    VPNSubscription, VPNPayment, VPNReferral,
    VPNSubscriptionStatus, VPNPaymentStatus, VPNPlanType
)
from ..schemas import (
    VPNSubscriptionResponse,
    VPNSubscriptionListResponse,
    VPNSubscriptionUpdate,
    VPNPaymentResponse,
    VPNPaymentListResponse,
    VPNStatsResponse,
)
from ..auth import get_current_user

router = APIRouter()

# Plan prices for revenue calculation
PLAN_PRICES = {
    VPNPlanType.month_1: {"stars": 60, "rub": 120},
    VPNPlanType.month_3: {"stars": 150, "rub": 300},
    VPNPlanType.year_1: {"stars": 500, "rub": 999},
}


def calculate_days_remaining(expires_at: Optional[datetime]) -> Optional[int]:
    """Calculate days remaining until expiration."""
    if not expires_at:
        return None
    delta = expires_at - datetime.utcnow()
    return max(0, delta.days)


def calculate_traffic_percent(used: float, limit: int) -> Optional[float]:
    """Calculate traffic usage percentage."""
    if limit <= 0:  # Unlimited
        return 0.0
    return min(100.0, (float(used) / limit) * 100)


@router.get("/stats", response_model=VPNStatsResponse)
async def get_vpn_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get VPN statistics for dashboard."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    expiring_soon_date = now + timedelta(days=3)

    # Active subscriptions
    active_result = await db.execute(
        select(func.count(VPNSubscription.id))
        .where(VPNSubscription.status == VPNSubscriptionStatus.active)
    )
    active_subscriptions = active_result.scalar() or 0

    # Total subscriptions
    total_result = await db.execute(select(func.count(VPNSubscription.id)))
    total_subscriptions = total_result.scalar() or 0

    # Expiring soon (within 3 days)
    expiring_result = await db.execute(
        select(func.count(VPNSubscription.id))
        .where(
            VPNSubscription.status == VPNSubscriptionStatus.active,
            VPNSubscription.expires_at.isnot(None),
            VPNSubscription.expires_at <= expiring_soon_date,
        )
    )
    expiring_soon = expiring_result.scalar() or 0

    # New today
    new_today_result = await db.execute(
        select(func.count(VPNSubscription.id))
        .where(VPNSubscription.created_at >= today_start)
    )
    new_today = new_today_result.scalar() or 0

    # Total payments
    payments_result = await db.execute(
        select(func.count(VPNPayment.id))
        .where(VPNPayment.status == VPNPaymentStatus.completed)
    )
    total_payments = payments_result.scalar() or 0

    # Revenue by plan
    by_plan = {}
    by_protocol = {"vless": 0, "shadowsocks": 0}
    total_revenue_stars = 0

    # Get completed payments grouped by plan
    payments_by_plan = await db.execute(
        select(VPNPayment.plan_type, func.count(VPNPayment.id), func.sum(VPNPayment.amount))
        .where(VPNPayment.status == VPNPaymentStatus.completed)
        .group_by(VPNPayment.plan_type)
    )

    for row in payments_by_plan:
        plan_type, count, amount = row
        by_plan[plan_type.value] = {"count": count, "revenue_stars": amount or 0}
        total_revenue_stars += amount or 0

    # Get subscriptions by protocol
    subs_by_protocol = await db.execute(
        select(VPNSubscription.protocol, func.count(VPNSubscription.id))
        .where(VPNSubscription.status == VPNSubscriptionStatus.active)
        .group_by(VPNSubscription.protocol)
    )

    for row in subs_by_protocol:
        protocol, count = row
        by_protocol[protocol.value] = count

    # Calculate RUB (Stars * 2)
    total_revenue_rub = total_revenue_stars * 2

    return VPNStatsResponse(
        active_subscriptions=active_subscriptions,
        total_subscriptions=total_subscriptions,
        expiring_soon=expiring_soon,
        new_today=new_today,
        total_revenue_stars=total_revenue_stars,
        total_revenue_rub=total_revenue_rub,
        total_payments=total_payments,
        by_plan=by_plan,
        by_protocol=by_protocol,
    )


@router.get("/subscriptions", response_model=VPNSubscriptionListResponse)
async def list_vpn_subscriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status_filter: Optional[VPNSubscriptionStatus] = None,
    plan_filter: Optional[VPNPlanType] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """List VPN subscriptions with pagination."""
    query = select(VPNSubscription)

    # Apply filters
    if status_filter:
        query = query.where(VPNSubscription.status == status_filter)
    if plan_filter:
        query = query.where(VPNSubscription.plan_type == plan_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Pagination
    offset = (page - 1) * page_size
    query = query.order_by(VPNSubscription.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    subscriptions = result.scalars().all()

    # Enrich with computed fields
    data = []
    for sub in subscriptions:
        data.append(VPNSubscriptionResponse(
            id=sub.id,
            telegram_id=sub.telegram_id,
            plan_type=sub.plan_type,
            protocol=sub.protocol,
            status=sub.status,
            marzban_username=sub.marzban_username,
            subscription_url=sub.subscription_url,
            traffic_limit_gb=sub.traffic_limit_gb,
            traffic_used_gb=float(sub.traffic_used_gb or 0),
            started_at=sub.started_at,
            expires_at=sub.expires_at,
            created_at=sub.created_at,
            updated_at=sub.updated_at,
            days_remaining=calculate_days_remaining(sub.expires_at),
            traffic_percent=calculate_traffic_percent(
                float(sub.traffic_used_gb or 0), sub.traffic_limit_gb
            ),
        ))

    return VPNSubscriptionListResponse(data=data, total=total)


@router.get("/subscriptions/{subscription_id}", response_model=VPNSubscriptionResponse)
async def get_vpn_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get VPN subscription by ID."""
    result = await db.execute(
        select(VPNSubscription).where(VPNSubscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    return VPNSubscriptionResponse(
        id=sub.id,
        telegram_id=sub.telegram_id,
        plan_type=sub.plan_type,
        protocol=sub.protocol,
        status=sub.status,
        marzban_username=sub.marzban_username,
        subscription_url=sub.subscription_url,
        traffic_limit_gb=sub.traffic_limit_gb,
        traffic_used_gb=float(sub.traffic_used_gb or 0),
        started_at=sub.started_at,
        expires_at=sub.expires_at,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
        days_remaining=calculate_days_remaining(sub.expires_at),
        traffic_percent=calculate_traffic_percent(
            float(sub.traffic_used_gb or 0), sub.traffic_limit_gb
        ),
    )


@router.patch("/subscriptions/{subscription_id}", response_model=VPNSubscriptionResponse)
async def update_vpn_subscription(
    subscription_id: int,
    data: VPNSubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Update VPN subscription."""
    result = await db.execute(
        select(VPNSubscription).where(VPNSubscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sub, field, value)

    await db.flush()
    await db.refresh(sub)

    return VPNSubscriptionResponse(
        id=sub.id,
        telegram_id=sub.telegram_id,
        plan_type=sub.plan_type,
        protocol=sub.protocol,
        status=sub.status,
        marzban_username=sub.marzban_username,
        subscription_url=sub.subscription_url,
        traffic_limit_gb=sub.traffic_limit_gb,
        traffic_used_gb=float(sub.traffic_used_gb or 0),
        started_at=sub.started_at,
        expires_at=sub.expires_at,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
        days_remaining=calculate_days_remaining(sub.expires_at),
        traffic_percent=calculate_traffic_percent(
            float(sub.traffic_used_gb or 0), sub.traffic_limit_gb
        ),
    )


@router.post("/subscriptions/{subscription_id}/disable", response_model=VPNSubscriptionResponse)
async def disable_vpn_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Disable (cancel) a VPN subscription."""
    result = await db.execute(
        select(VPNSubscription).where(VPNSubscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    sub.status = VPNSubscriptionStatus.cancelled
    await db.flush()
    await db.refresh(sub)

    # TODO: Also disable user in Marzban

    return VPNSubscriptionResponse(
        id=sub.id,
        telegram_id=sub.telegram_id,
        plan_type=sub.plan_type,
        protocol=sub.protocol,
        status=sub.status,
        marzban_username=sub.marzban_username,
        subscription_url=sub.subscription_url,
        traffic_limit_gb=sub.traffic_limit_gb,
        traffic_used_gb=float(sub.traffic_used_gb or 0),
        started_at=sub.started_at,
        expires_at=sub.expires_at,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
        days_remaining=calculate_days_remaining(sub.expires_at),
        traffic_percent=calculate_traffic_percent(
            float(sub.traffic_used_gb or 0), sub.traffic_limit_gb
        ),
    )


@router.post("/subscriptions/{subscription_id}/extend", response_model=VPNSubscriptionResponse)
async def extend_vpn_subscription(
    subscription_id: int,
    days: int = Query(..., ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Extend a VPN subscription by specified days."""
    result = await db.execute(
        select(VPNSubscription).where(VPNSubscription.id == subscription_id)
    )
    sub = result.scalar_one_or_none()

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    # Extend from current expiry or from now
    base_date = sub.expires_at if sub.expires_at and sub.expires_at > datetime.utcnow() else datetime.utcnow()
    sub.expires_at = base_date + timedelta(days=days)

    # If was expired, reactivate
    if sub.status == VPNSubscriptionStatus.expired:
        sub.status = VPNSubscriptionStatus.active

    await db.flush()
    await db.refresh(sub)

    # TODO: Also extend user in Marzban

    return VPNSubscriptionResponse(
        id=sub.id,
        telegram_id=sub.telegram_id,
        plan_type=sub.plan_type,
        protocol=sub.protocol,
        status=sub.status,
        marzban_username=sub.marzban_username,
        subscription_url=sub.subscription_url,
        traffic_limit_gb=sub.traffic_limit_gb,
        traffic_used_gb=float(sub.traffic_used_gb or 0),
        started_at=sub.started_at,
        expires_at=sub.expires_at,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
        days_remaining=calculate_days_remaining(sub.expires_at),
        traffic_percent=calculate_traffic_percent(
            float(sub.traffic_used_gb or 0), sub.traffic_limit_gb
        ),
    )


@router.get("/payments", response_model=VPNPaymentListResponse)
async def list_vpn_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status_filter: Optional[VPNPaymentStatus] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """List VPN payments with pagination."""
    query = select(VPNPayment)

    if status_filter:
        query = query.where(VPNPayment.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Pagination
    offset = (page - 1) * page_size
    query = query.order_by(VPNPayment.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    payments = result.scalars().all()

    data = [
        VPNPaymentResponse(
            id=p.id,
            telegram_id=p.telegram_id,
            amount=p.amount,
            currency=p.currency,
            payment_system=p.payment_system,
            payment_id=p.payment_id,
            plan_type=p.plan_type,
            status=p.status,
            created_at=p.created_at,
            completed_at=p.completed_at,
            subscription_id=p.subscription_id,
        )
        for p in payments
    ]

    return VPNPaymentListResponse(data=data, total=total)


# ============= Telegram Stars API =============

import httpx
from ..config import settings


@router.get("/balance")
async def get_vpn_bot_balance(
    _=Depends(get_current_user),
):
    """Get VPN bot's Telegram Stars balance."""
    if not settings.vpn_bot_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VPN bot token not configured",
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.telegram.org/bot{settings.vpn_bot_token}/getMyStarBalance"
        )
        data = response.json()

        if not data.get("ok"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Telegram API error: {data.get('description', 'Unknown error')}",
            )

        return {
            "balance": data["result"]["amount"],
            "balance_rub": data["result"]["amount"] * 2,  # ~2 RUB per star
        }


@router.get("/transactions")
async def get_vpn_star_transactions(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _=Depends(get_current_user),
):
    """Get VPN bot's Telegram Stars transactions."""
    if not settings.vpn_bot_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VPN bot token not configured",
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.telegram.org/bot{settings.vpn_bot_token}/getStarTransactions",
            params={"offset": offset, "limit": limit},
        )
        data = response.json()

        if not data.get("ok"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Telegram API error: {data.get('description', 'Unknown error')}",
            )

        transactions = data["result"].get("transactions", [])

        # Transform transactions for frontend
        result = []
        for txn in transactions:
            result.append({
                "id": txn.get("id"),
                "amount": txn.get("amount", 0),
                "date": txn.get("date"),
                "source": txn.get("source"),
                "receiver": txn.get("receiver"),
            })

        return {"transactions": result, "total": len(result)}


# ============= User Profile =============

@router.get("/users/{telegram_id}")
async def get_vpn_user_profile(
    telegram_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get VPN user profile with all subscriptions and payments."""
    # Get all subscriptions for this user
    subs_result = await db.execute(
        select(VPNSubscription)
        .where(VPNSubscription.telegram_id == telegram_id)
        .order_by(VPNSubscription.created_at.desc())
    )
    subscriptions = subs_result.scalars().all()

    # Get all payments for this user
    payments_result = await db.execute(
        select(VPNPayment)
        .where(VPNPayment.telegram_id == telegram_id)
        .order_by(VPNPayment.created_at.desc())
    )
    payments = payments_result.scalars().all()

    # Calculate stats
    total_spent_stars = sum(p.amount for p in payments if p.status == VPNPaymentStatus.completed)
    active_subscription = next(
        (s for s in subscriptions if s.status == VPNSubscriptionStatus.active),
        None
    )

    # Format subscriptions
    subs_data = [
        VPNSubscriptionResponse(
            id=sub.id,
            telegram_id=sub.telegram_id,
            plan_type=sub.plan_type,
            protocol=sub.protocol,
            status=sub.status,
            marzban_username=sub.marzban_username,
            subscription_url=sub.subscription_url,
            traffic_limit_gb=sub.traffic_limit_gb,
            traffic_used_gb=float(sub.traffic_used_gb or 0),
            started_at=sub.started_at,
            expires_at=sub.expires_at,
            created_at=sub.created_at,
            updated_at=sub.updated_at,
            days_remaining=calculate_days_remaining(sub.expires_at),
            traffic_percent=calculate_traffic_percent(
                float(sub.traffic_used_gb or 0), sub.traffic_limit_gb
            ),
        )
        for sub in subscriptions
    ]

    # Format payments
    payments_data = [
        VPNPaymentResponse(
            id=p.id,
            telegram_id=p.telegram_id,
            amount=p.amount,
            currency=p.currency,
            payment_system=p.payment_system,
            payment_id=p.payment_id,
            plan_type=p.plan_type,
            status=p.status,
            created_at=p.created_at,
            completed_at=p.completed_at,
            subscription_id=p.subscription_id,
        )
        for p in payments
    ]

    return {
        "telegram_id": telegram_id,
        "total_subscriptions": len(subscriptions),
        "total_payments": len(payments),
        "total_spent_stars": total_spent_stars,
        "total_spent_rub": total_spent_stars * 2,
        "has_active_subscription": active_subscription is not None,
        "active_subscription": subs_data[0] if active_subscription else None,
        "subscriptions": subs_data,
        "payments": payments_data,
    }
