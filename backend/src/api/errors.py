"""
Download Errors API endpoints.
"""
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import DownloadError
from ..auth import get_current_user

router = APIRouter()


class ErrorResponse(BaseModel):
    id: int
    user_id: Optional[int]
    bot_id: Optional[int]
    platform: str
    url: str
    error_type: str
    error_message: Optional[str]
    error_details: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorListResponse(BaseModel):
    data: List[ErrorResponse]
    total: int
    page: int
    page_size: int


class ErrorStatsResponse(BaseModel):
    total_errors: int
    errors_today: int
    errors_by_platform: dict
    errors_by_type: dict


@router.get("", response_model=ErrorListResponse)
async def list_errors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    platform: Optional[str] = None,
    error_type: Optional[str] = None,
    bot_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """List download errors with pagination and filtering."""
    query = select(DownloadError)

    if platform:
        query = query.where(DownloadError.platform == platform)
    if error_type:
        query = query.where(DownloadError.error_type == error_type)
    if bot_id is not None:
        query = query.where(DownloadError.bot_id == bot_id)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(DownloadError.created_at.desc())

    result = await db.execute(query)
    errors = result.scalars().all()

    return ErrorListResponse(
        data=[ErrorResponse.model_validate(e) for e in errors],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=ErrorStatsResponse)
async def get_error_stats(
    bot_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get download error statistics."""
    base_filter = []
    if bot_id is not None:
        base_filter.append(DownloadError.bot_id == bot_id)

    # Total errors
    query = select(func.count(DownloadError.id))
    for f in base_filter:
        query = query.where(f)
    result = await db.execute(query)
    total_errors = result.scalar() or 0

    # Errors today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query = select(func.count(DownloadError.id)).where(
        DownloadError.created_at >= today_start
    )
    for f in base_filter:
        query = query.where(f)
    result = await db.execute(query)
    errors_today = result.scalar() or 0

    # Errors by platform
    query = select(DownloadError.platform, func.count(DownloadError.id)).group_by(DownloadError.platform)
    for f in base_filter:
        query = query.where(f)
    result = await db.execute(query)
    errors_by_platform = {row[0]: row[1] for row in result.fetchall()}

    # Errors by type
    query = select(DownloadError.error_type, func.count(DownloadError.id)).group_by(DownloadError.error_type)
    for f in base_filter:
        query = query.where(f)
    result = await db.execute(query)
    errors_by_type = {row[0]: row[1] for row in result.fetchall()}

    return ErrorStatsResponse(
        total_errors=total_errors,
        errors_today=errors_today,
        errors_by_platform=errors_by_platform,
        errors_by_type=errors_by_type,
    )


@router.get("/platforms")
async def get_error_platforms(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get unique platform values from download errors."""
    result = await db.execute(
        select(DownloadError.platform).distinct().order_by(DownloadError.platform)
    )
    platforms = [row[0] for row in result.all()]
    return {"platforms": platforms}


@router.get("/types")
async def get_error_types(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get unique error_type values from download errors."""
    result = await db.execute(
        select(DownloadError.error_type).distinct().order_by(DownloadError.error_type)
    )
    types = [row[0] for row in result.all()]
    return {"types": types}
