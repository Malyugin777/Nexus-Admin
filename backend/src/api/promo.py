"""
Promocode batch generation API endpoints.
"""
import secrets
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Promocode, PromocodeActivation
from ..schemas import (
    PromoGenerateRequest,
    PromoGenerateResponse,
    PromoCodeResponse,
    PromoBatchResponse,
)
from ..auth import get_current_user

router = APIRouter()


@router.post("/generate", response_model=PromoGenerateResponse)
async def generate_batch(
    request: PromoGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Generate a batch of promocodes.

    - **prefix**: Code prefix (e.g., 'INSTA' -> 'INSTA_A1B2C3')
    - **count**: Number of codes to generate (1-1000)
    - **days**: Days of VPN access
    - **traffic_gb**: Traffic limit in GB (0 = unlimited)
    - **campaign_name**: Campaign name for tracking
    """
    batch_id = str(uuid.uuid4())[:8].upper()
    codes = []
    attempts = 0
    max_attempts = request.count * 3  # Allow retries for collisions

    while len(codes) < request.count and attempts < max_attempts:
        attempts += 1
        # Generate unique code: PREFIX_XXXXXX (6 hex chars)
        suffix = secrets.token_hex(3).upper()
        code = f"{request.prefix.upper()}_{suffix}"

        # Check if code already exists
        existing = await db.execute(
            select(Promocode.id).where(Promocode.code == code)
        )
        if existing.scalar_one_or_none():
            continue  # Collision, try again

        promo = Promocode(
            code=code,
            batch_id=batch_id,
            campaign_name=request.campaign_name,
            days=request.days,
            traffic_gb=request.traffic_gb,
            max_activations=request.max_activations,
            current_activations=0,
            active=True,
        )
        db.add(promo)
        codes.append(code)

    if len(codes) < request.count:
        raise HTTPException(
            status_code=500,
            detail=f"Could only generate {len(codes)} unique codes, requested {request.count}"
        )

    await db.commit()

    return PromoGenerateResponse(
        batch_id=batch_id,
        codes=codes,
        count=len(codes),
        campaign_name=request.campaign_name,
    )


@router.get("/batches", response_model=list[PromoBatchResponse])
async def list_batches(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """List all promocode batches with stats."""
    # Get batch stats using subquery
    result = await db.execute(
        select(
            Promocode.batch_id,
            Promocode.campaign_name,
            func.count(Promocode.id).label("codes_count"),
            func.sum(Promocode.current_activations).label("total_activations"),
            func.sum(func.cast(Promocode.active, Integer)).label("active_codes"),
            func.min(Promocode.created_at).label("created_at"),
        )
        .where(Promocode.batch_id.isnot(None))
        .group_by(Promocode.batch_id, Promocode.campaign_name)
        .order_by(func.min(Promocode.created_at).desc())
    )

    batches = []
    for row in result.all():
        batches.append(PromoBatchResponse(
            batch_id=row.batch_id,
            campaign_name=row.campaign_name,
            codes_count=row.codes_count,
            total_activations=int(row.total_activations or 0),
            active_codes=int(row.active_codes or 0),
            created_at=row.created_at,
        ))

    return batches


@router.get("/codes", response_model=list[PromoCodeResponse])
async def list_codes(
    batch_id: Optional[str] = Query(None, description="Filter by batch ID"),
    active_only: bool = Query(False, description="Show only active codes"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """List promocodes, optionally filtered by batch_id."""
    query = select(Promocode).order_by(Promocode.created_at.desc())

    if batch_id:
        query = query.where(Promocode.batch_id == batch_id)
    if active_only:
        query = query.where(Promocode.active == True)

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    codes = result.scalars().all()

    return [PromoCodeResponse.model_validate(code) for code in codes]


@router.delete("/batch/{batch_id}")
async def revoke_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Revoke (deactivate) all codes in a batch."""
    result = await db.execute(
        update(Promocode)
        .where(Promocode.batch_id == batch_id)
        .values(active=False)
    )
    await db.commit()

    return {
        "batch_id": batch_id,
        "revoked_count": result.rowcount,
        "message": f"Revoked {result.rowcount} codes in batch {batch_id}",
    }


@router.delete("/code/{code}")
async def revoke_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Revoke (deactivate) a single promocode."""
    result = await db.execute(
        update(Promocode)
        .where(Promocode.code == code.upper())
        .values(active=False)
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"Code {code} not found")

    return {"code": code.upper(), "message": "Code revoked successfully"}


@router.get("/stats")
async def get_promo_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get overall promocode statistics."""
    # Total codes
    total_result = await db.execute(select(func.count(Promocode.id)))
    total_codes = total_result.scalar() or 0

    # Active codes
    active_result = await db.execute(
        select(func.count(Promocode.id)).where(Promocode.active == True)
    )
    active_codes = active_result.scalar() or 0

    # Total activations
    activations_result = await db.execute(
        select(func.sum(Promocode.current_activations))
    )
    total_activations = int(activations_result.scalar() or 0)

    # Batches count
    batches_result = await db.execute(
        select(func.count(func.distinct(Promocode.batch_id)))
        .where(Promocode.batch_id.isnot(None))
    )
    batches_count = batches_result.scalar() or 0

    return {
        "total_codes": total_codes,
        "active_codes": active_codes,
        "total_activations": total_activations,
        "batches_count": batches_count,
    }
