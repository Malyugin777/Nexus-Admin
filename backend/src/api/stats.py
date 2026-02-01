"""
Statistics API endpoints.
"""
from datetime import datetime, timedelta
import random
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..redis_client import get_redis
from ..config import settings
from ..models import Bot, User, BotUser, Broadcast, ActionLog, DownloadError, BotStatus, BroadcastStatus
from ..schemas import StatsResponse, LoadChartResponse, ChartDataPoint, PerformanceResponse, PlatformPerformance

# Actions that count as "successful operations" for stats (multi-bot)
SUCCESS_ACTIONS = ["download_success", "music_download"]
from ..auth import get_current_user


class FlyerStatsResponse(BaseModel):
    """Статистика FlyerService."""
    # Сегодня
    downloads_today: int           # Все скачивания
    ad_offers_today: int           # Уникальные юзеры которым показали рекламу
    subscribed_today: int          # Подписались (flyer_sub_completed)

    # За всё время
    downloads_total: int
    ad_offers_total: int
    subscribed_total: int

router = APIRouter()


@router.get("", response_model=StatsResponse)
async def get_stats(
    days: int = Query(1, ge=1, le=30),
    bot_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get dashboard statistics. days=1 means today, 7=week, 30=month."""
    # Period start
    since = (datetime.utcnow() - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Total bots
    result = await db.execute(select(func.count(Bot.id)))
    total_bots = result.scalar() or 0

    # Active bots
    result = await db.execute(
        select(func.count(Bot.id)).where(Bot.status == BotStatus.ACTIVE)
    )
    active_bots = result.scalar() or 0

    # Total users
    if bot_id is not None:
        # For specific bot: count BotUser records
        result = await db.execute(
            select(func.count(BotUser.id)).where(BotUser.bot_id == bot_id)
        )
    else:
        # Global: count all users
        result = await db.execute(select(func.count(User.id)))
    total_users = result.scalar() or 0

    # Active users in period
    if bot_id is not None:
        # For specific bot: count BotUser records with User.last_active_at
        result = await db.execute(
            select(func.count(BotUser.id))
            .join(User, BotUser.user_id == User.id)
            .where(BotUser.bot_id == bot_id, User.last_active_at >= since)
        )
    else:
        # Global: count all active users
        result = await db.execute(
            select(func.count(User.id)).where(User.last_active_at >= since)
        )
    active_users_today = result.scalar() or 0

    # Downloads in period
    query = select(func.count(ActionLog.id)).where(
        ActionLog.created_at >= since,
        ActionLog.action.in_(SUCCESS_ACTIONS)
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)
    downloads_today = result.scalar() or 0

    # Total downloads
    query = select(func.count(ActionLog.id)).where(
        ActionLog.action.in_(SUCCESS_ACTIONS)
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)
    total_downloads = result.scalar() or 0

    # Messages in queue (from Redis)
    try:
        redis = await get_redis()
        queue_length = await redis.llen("message_queue") or 0
    except Exception:
        queue_length = 0

    # Running broadcasts
    result = await db.execute(
        select(func.count(Broadcast.id)).where(Broadcast.status == BroadcastStatus.RUNNING)
    )
    broadcasts_running = result.scalar() or 0

    # Errors in period
    query = select(func.count(DownloadError.id)).where(
        DownloadError.created_at >= since
    )
    if bot_id is not None:
        query = query.where(DownloadError.bot_id == bot_id)
    result = await db.execute(query)
    errors_period = result.scalar() or 0

    # Errors by platform
    query = select(
        DownloadError.platform,
        func.count(DownloadError.id).label("count")
    ).where(DownloadError.created_at >= since)
    if bot_id is not None:
        query = query.where(DownloadError.bot_id == bot_id)
    result = await db.execute(query.group_by(DownloadError.platform))
    errors_by_platform = {row.platform: row.count for row in result}

    return StatsResponse(
        version=settings.version,
        total_bots=total_bots,
        active_bots=active_bots,
        total_users=total_users,
        active_users_today=active_users_today,
        downloads_today=downloads_today,
        total_downloads=total_downloads,
        messages_in_queue=queue_length,
        broadcasts_running=broadcasts_running,
        errors_period=errors_period,
        errors_by_platform=errors_by_platform,
    )


@router.get("/chart", response_model=LoadChartResponse)
async def get_load_chart(
    days: int = 7,
    bot_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Get load chart data for the last N days.
    Shows downloads and new users per day.
    Optimized: 2 queries instead of 14 (7 days × 2 metrics).
    """
    start_date = (datetime.utcnow() - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Downloads per day - single query with GROUP BY
    query = select(
        func.date(ActionLog.created_at).label("date"),
        func.count(ActionLog.id).label("count")
    ).where(
        ActionLog.created_at >= start_date,
        ActionLog.action.in_(SUCCESS_ACTIONS)
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(
        query.group_by(func.date(ActionLog.created_at))
        .order_by(func.date(ActionLog.created_at))
    )
    downloads_map = {str(row.date): row.count for row in result}

    # New users per day - single query with GROUP BY
    if bot_id is not None:
        # For specific bot: count BotUser.joined_at
        result = await db.execute(
            select(
                func.date(BotUser.joined_at).label("date"),
                func.count(BotUser.id).label("count")
            )
            .where(BotUser.joined_at >= start_date, BotUser.bot_id == bot_id)
            .group_by(func.date(BotUser.joined_at))
            .order_by(func.date(BotUser.joined_at))
        )
    else:
        # Global: count User.created_at
        result = await db.execute(
            select(
                func.date(User.created_at).label("date"),
                func.count(User.id).label("count")
            )
            .where(User.created_at >= start_date)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )
    users_map = {str(row.date): row.count for row in result}

    # Build response with all days (fill missing days with 0)
    downloads_data = []
    users_data = []

    for i in range(days - 1, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        date_str = day.strftime("%Y-%m-%d")

        downloads_data.append(ChartDataPoint(
            date=date_str,
            value=downloads_map.get(date_str, 0)
        ))
        users_data.append(ChartDataPoint(
            date=date_str,
            value=users_map.get(date_str, 0)
        ))

    return LoadChartResponse(
        messages=downloads_data,  # Renamed to downloads in frontend
        users=users_data,
    )


@router.get("/platforms")
async def get_platform_stats(
    days: int = Query(90, ge=1, le=365),
    bot_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Get download statistics by platform.
    Limited to last N days to prevent OOM (default 90 days).
    """
    start_date = datetime.utcnow() - timedelta(days=days)

    # Try to use PostgreSQL JSON extraction for 'platform' field first
    # Then fall back to parsing 'info' field for older records
    query = select(ActionLog.details).where(
        ActionLog.action.in_(SUCCESS_ACTIONS),
        ActionLog.created_at >= start_date
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)

    platform_counts: dict[str, int] = {}
    for row in result:
        details = row[0]
        if not details or not isinstance(details, dict):
            continue

        # Try direct 'platform' field first (newer format)
        platform = details.get('platform')

        # Fall back to parsing 'info' field (older format)
        if not platform and 'info' in details:
            info = details['info']
            # Parse "video:instagram" -> "instagram"
            if ':' in info:
                platform = info.split(':')[-1]  # Get last part after ':'
            else:
                platform = info

        if platform:
            platform_counts[platform] = platform_counts.get(platform, 0) + 1

    return {
        "platforms": [
            {"name": name, "count": count}
            for name, count in sorted(platform_counts.items(), key=lambda x: -x[1])
        ]
    }


@router.get("/performance", response_model=PerformanceResponse)
async def get_performance_stats(
    days: int = Query(30, ge=1, le=365),
    bot_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Get performance metrics (download time, file size, speed) by platform.
    Limited to last N days to prevent OOM (default 30 days).
    """
    start_date = datetime.utcnow() - timedelta(days=days)

    # Overall metrics (last N days)
    query = select(
        func.avg(ActionLog.download_time_ms).label('avg_time'),
        func.avg(ActionLog.file_size_bytes).label('avg_size'),
        func.avg(ActionLog.download_speed_kbps).label('avg_speed'),
        func.count(ActionLog.id).label('total')
    ).where(
        ActionLog.action.in_(SUCCESS_ACTIONS),
        ActionLog.download_time_ms.isnot(None),
        ActionLog.created_at >= start_date
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)
    row = result.first()

    overall = PlatformPerformance(
        platform="overall",
        avg_download_time_ms=round(row.avg_time, 2) if row.avg_time else None,
        avg_file_size_mb=round(row.avg_size / 1024 / 1024, 2) if row.avg_size else None,
        avg_speed_kbps=round(row.avg_speed, 2) if row.avg_speed else None,
        total_downloads=row.total or 0
    )

    # Per-platform metrics (last N days)
    query = select(
        ActionLog.details,
        ActionLog.download_time_ms,
        ActionLog.file_size_bytes,
        ActionLog.download_speed_kbps
    ).where(
        ActionLog.action.in_(SUCCESS_ACTIONS),
        ActionLog.download_time_ms.isnot(None),
        ActionLog.created_at >= start_date
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)

    platform_metrics: dict[str, dict] = {}
    for row in result:
        details = row.details
        if not details or not isinstance(details, dict):
            continue

        # Try direct 'platform' field first (newer format)
        platform = details.get('platform')

        # Fall back to parsing 'info' field (older format)
        if not platform and 'info' in details:
            info = details['info']
            if ':' in info:
                parts = info.split(':')
                platform = parts[1] if parts[1] not in ['http', 'https'] else parts[0]
            else:
                platform = info

        if not platform:
            continue

        if platform not in platform_metrics:
            platform_metrics[platform] = {
                'time': [],
                'size': [],
                'speed': [],
                'total': 0
            }

        platform_metrics[platform]['time'].append(row.download_time_ms or 0)
        platform_metrics[platform]['size'].append(row.file_size_bytes or 0)
        platform_metrics[platform]['speed'].append(row.download_speed_kbps or 0)
        platform_metrics[platform]['total'] += 1

    platforms = []
    for name, metrics in sorted(platform_metrics.items(), key=lambda x: -x[1]['total']):
        avg_time = sum(metrics['time']) / len(metrics['time']) if metrics['time'] else None
        avg_size = sum(metrics['size']) / len(metrics['size']) if metrics['size'] else None
        avg_speed = sum(metrics['speed']) / len(metrics['speed']) if metrics['speed'] else None

        platforms.append(PlatformPerformance(
            platform=name,
            avg_download_time_ms=round(avg_time, 2) if avg_time else None,
            avg_file_size_mb=round(avg_size / 1024 / 1024, 2) if avg_size else None,
            avg_speed_kbps=round(avg_speed, 2) if avg_speed else None,
            total_downloads=metrics['total']
        ))

    return PerformanceResponse(
        overall=overall,
        platforms=platforms
    )


@router.get("/api-usage")
async def get_api_usage(
    bot_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Get API usage statistics — dynamic, shows all api_source values from DB.
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Today's usage - single query with GROUP BY
    query = select(
        ActionLog.api_source,
        func.count(ActionLog.id).label("count")
    ).where(
        ActionLog.created_at >= today_start,
        ActionLog.action.in_(SUCCESS_ACTIONS),
        ActionLog.api_source.isnot(None)
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query.group_by(ActionLog.api_source))
    today_counts = {row.api_source: row.count for row in result}

    # Month's usage - single query with GROUP BY
    query = select(
        ActionLog.api_source,
        func.count(ActionLog.id).label("count")
    ).where(
        ActionLog.created_at >= month_start,
        ActionLog.action.in_(SUCCESS_ACTIONS),
        ActionLog.api_source.isnot(None)
    )
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query.group_by(ActionLog.api_source))
    month_counts = {row.api_source: row.count for row in result}

    # Known limits (per month)
    LIMITS = {
        "rapidapi": 6000,
    }

    # Build dynamic response — all sources that have any usage
    all_sources = set(today_counts.keys()) | set(month_counts.keys())
    sources = {}
    for source in sorted(all_sources):
        sources[source] = {
            "today": today_counts.get(source, 0),
            "month": month_counts.get(source, 0),
            "limit": LIMITS.get(source),
        }

    return {"sources": sources}


@router.get("/flyer", response_model=FlyerStatsResponse)
async def get_flyer_stats(
    bot_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Статистика FlyerService.
    - downloads: все скачивания
    - ad_offers: уникальные юзеры которым показали рекламу
    - subscribed: кто подписался через FlyerService
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # === 1. Скачивания (всего) ===
    query = select(
        func.count(ActionLog.id).filter(ActionLog.created_at >= today_start).label("today"),
        func.count(ActionLog.id).label("total")
    ).where(ActionLog.action.in_(SUCCESS_ACTIONS))
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)
    row = result.first()
    downloads_today = row.today or 0
    downloads_total = row.total or 0

    # === 2. Предложения рекламы (УНИКАЛЬНЫЕ юзеры) ===
    query = select(
        func.count(func.distinct(ActionLog.user_id)).filter(ActionLog.created_at >= today_start).label("today"),
        func.count(func.distinct(ActionLog.user_id)).label("total")
    ).where(ActionLog.action == "flyer_ad_shown")
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)
    row = result.first()
    ad_offers_today = row.today or 0
    ad_offers_total = row.total or 0

    # === 3. Подписки (flyer_sub_completed) ===
    query = select(
        func.count(ActionLog.id).filter(ActionLog.created_at >= today_start).label("today"),
        func.count(ActionLog.id).label("total")
    ).where(ActionLog.action == "flyer_sub_completed")
    if bot_id is not None:
        query = query.where(ActionLog.bot_id == bot_id)
    result = await db.execute(query)
    row = result.first()
    subscribed_today = row.today or 0
    subscribed_total = row.total or 0

    return FlyerStatsResponse(
        downloads_today=downloads_today,
        ad_offers_today=ad_offers_today,
        subscribed_today=subscribed_today,
        downloads_total=downloads_total,
        ad_offers_total=ad_offers_total,
        subscribed_total=subscribed_total,
    )
