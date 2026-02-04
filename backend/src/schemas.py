"""
Pydantic schemas for API requests/responses.
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, EmailStr

from .models import (
    UserRole, BotStatus, BroadcastStatus, SubscriptionProvider, BillingCycle, SubscriptionStatus,
    VPNPlanType, VPNProtocol, VPNSubscriptionStatus, VPNPaymentStatus, VPNPaymentSystem
)


# ============ Stats ============

class StatsResponse(BaseModel):
    version: str
    total_bots: int
    active_bots: int
    total_users: int
    active_users_today: int  # DAU за период
    downloads_today: int     # Скачивания за период
    total_downloads: int
    messages_in_queue: int
    broadcasts_running: int
    errors_period: int = 0
    errors_by_platform: dict = {}


class ChartDataPoint(BaseModel):
    date: str
    value: int


class LoadChartResponse(BaseModel):
    messages: List[ChartDataPoint]
    users: List[ChartDataPoint]


class PlatformPerformance(BaseModel):
    platform: str
    avg_download_time_ms: Optional[float] = None
    avg_file_size_mb: Optional[float] = None
    avg_speed_kbps: Optional[float] = None
    total_downloads: int


class PerformanceResponse(BaseModel):
    overall: PlatformPerformance
    platforms: List[PlatformPerformance]


# ============ Bots ============

class BotBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    username: Optional[str] = None
    description: Optional[str] = None
    webhook_url: Optional[str] = None
    status: BotStatus = BotStatus.ACTIVE
    settings: Optional[dict] = None


class BotCreate(BotBase):
    token: str = Field(..., min_length=40)  # Token to hash


class BotUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    username: Optional[str] = None
    description: Optional[str] = None
    webhook_url: Optional[str] = None
    status: Optional[BotStatus] = None
    settings: Optional[dict] = None
    token: Optional[str] = None  # Optional token update


class BotResponse(BotBase):
    id: int
    token_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    users_count: int = 0
    downloads_count: int = 0

    class Config:
        from_attributes = True


class BotListResponse(BaseModel):
    data: List[BotResponse]
    total: int
    page: int
    page_size: int


# ============ Users ============

class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    language_code: Optional[str]
    role: UserRole
    is_banned: bool
    ban_reason: Optional[str]
    created_at: datetime
    last_active_at: Optional[datetime]
    downloads_count: int = 0

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    data: List[UserResponse]
    total: int
    page: int
    page_size: int


class UserBanRequest(BaseModel):
    is_banned: bool
    ban_reason: Optional[str] = None


class UserRoleUpdate(BaseModel):
    role: UserRole


# ============ Broadcasts ============

class InlineButton(BaseModel):
    text: str
    url: Optional[str] = None
    callback_data: Optional[str] = None


class BroadcastBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    text: str = Field(..., min_length=1)
    image_url: Optional[str] = None
    message_video: Optional[str] = None
    buttons: Optional[List[InlineButton]] = None  # List of buttons
    target_type: str = "all"  # 'all', 'segment', 'list'
    target_bots: Optional[List[int]] = None
    target_languages: Optional[List[str]] = None
    target_segment_id: Optional[int] = None
    target_user_ids: Optional[List[int]] = None


class BroadcastCreate(BroadcastBase):
    scheduled_at: Optional[datetime] = None


class BroadcastUpdate(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    image_url: Optional[str] = None
    message_video: Optional[str] = None
    buttons: Optional[List[InlineButton]] = None
    target_type: Optional[str] = None
    target_bots: Optional[List[int]] = None
    target_languages: Optional[List[str]] = None
    target_segment_id: Optional[int] = None
    target_user_ids: Optional[List[int]] = None
    scheduled_at: Optional[datetime] = None


class BroadcastResponse(BroadcastBase):
    id: int
    status: BroadcastStatus
    scheduled_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    total_recipients: int
    sent_count: int
    delivered_count: int
    failed_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class BroadcastListResponse(BaseModel):
    data: List[BroadcastResponse]
    total: int
    page: int
    page_size: int


class BroadcastProgress(BaseModel):
    status: str
    total: int
    sent: int
    delivered: int
    failed: int
    progress_percent: float


# ============ Segments ============

class SegmentCondition(BaseModel):
    field: str
    op: str  # 'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'
    value: Any


class SegmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    conditions: dict = Field(default_factory=dict)
    is_dynamic: bool = True


class SegmentCreate(SegmentBase):
    pass


class SegmentResponse(SegmentBase):
    id: int
    cached_count: Optional[int]
    cached_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SegmentListResponse(BaseModel):
    data: List[SegmentResponse]
    total: int


# ============ Auth ============

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)


class AdminUserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


# ============ Logs ============

class LogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    bot_id: Optional[int]
    action: str
    details: Optional[dict]
    created_at: datetime
    # Joined fields
    username: Optional[str] = None
    first_name: Optional[str] = None
    bot_name: Optional[str] = None

    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    data: List[LogResponse]
    total: int
    page: int
    page_size: int


# ============ Subscriptions (Billing Tracker) ============

class SubscriptionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    provider: SubscriptionProvider = SubscriptionProvider.OTHER
    provider_url: Optional[str] = None
    ip_address: Optional[str] = None
    amount: float = 0.0
    currency: str = Field(default="RUB", max_length=3)
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    next_payment_date: Optional[datetime] = None
    auto_renew: bool = True
    notify_days: List[int] = Field(default=[7, 3, 1])
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE


class SubscriptionCreate(SubscriptionBase):
    pass


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    provider: Optional[SubscriptionProvider] = None
    provider_url: Optional[str] = None
    ip_address: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = Field(None, max_length=3)
    billing_cycle: Optional[BillingCycle] = None
    next_payment_date: Optional[datetime] = None
    auto_renew: Optional[bool] = None
    notify_days: Optional[List[int]] = None
    status: Optional[SubscriptionStatus] = None


class SubscriptionResponse(SubscriptionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    days_until_payment: Optional[int] = None  # Computed field

    class Config:
        from_attributes = True


class SubscriptionListResponse(BaseModel):
    data: List[SubscriptionResponse]
    total: int


class UpcomingPayment(BaseModel):
    id: int
    name: str
    provider: SubscriptionProvider
    amount: float
    currency: str
    next_payment_date: datetime
    days_until: int


# ============ Bot Messages ============

class BotMessageBase(BaseModel):
    message_key: str = Field(..., min_length=1, max_length=50)
    text_ru: str
    text_en: Optional[str] = None
    is_active: bool = True


class BotMessageCreate(BotMessageBase):
    bot_id: int


class BotMessageUpdate(BaseModel):
    text_ru: Optional[str] = None
    text_en: Optional[str] = None
    is_active: Optional[bool] = None


class BotMessageResponse(BotMessageBase):
    id: int
    bot_id: int
    updated_at: datetime
    # Joined fields
    bot_name: Optional[str] = None

    class Config:
        from_attributes = True


class BotMessageListResponse(BaseModel):
    data: List[BotMessageResponse]
    total: int


# ============ VPN Subscriptions ============

class VPNSubscriptionBase(BaseModel):
    plan_type: VPNPlanType
    protocol: VPNProtocol = VPNProtocol.vless
    status: VPNSubscriptionStatus = VPNSubscriptionStatus.active
    traffic_limit_gb: int = 0  # 0 = unlimited


class VPNSubscriptionCreate(VPNSubscriptionBase):
    telegram_id: int
    marzban_username: str
    subscription_url: Optional[str] = None
    started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class VPNSubscriptionManualCreate(BaseModel):
    """Schema for manual subscription creation from admin panel."""
    telegram_id: int
    plan_type: VPNPlanType
    protocol: VPNProtocol = VPNProtocol.vless


class VPNSubscriptionUpdate(BaseModel):
    status: Optional[VPNSubscriptionStatus] = None
    traffic_limit_gb: Optional[int] = None
    expires_at: Optional[datetime] = None


class VPNSubscriptionResponse(VPNSubscriptionBase):
    id: int
    telegram_id: int
    marzban_username: str
    subscription_url: Optional[str]
    traffic_used_gb: float = 0
    started_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    # Computed fields
    days_remaining: Optional[int] = None
    traffic_percent: Optional[float] = None

    class Config:
        from_attributes = True


class VPNSubscriptionListResponse(BaseModel):
    data: List[VPNSubscriptionResponse]
    total: int


# ============ VPN Payments ============

class VPNPaymentResponse(BaseModel):
    id: int
    telegram_id: int
    amount: int
    currency: str
    payment_system: VPNPaymentSystem
    payment_id: Optional[str]
    plan_type: VPNPlanType
    status: VPNPaymentStatus
    created_at: datetime
    completed_at: Optional[datetime]
    # Joined fields
    subscription_id: Optional[int] = None

    class Config:
        from_attributes = True


class VPNPaymentListResponse(BaseModel):
    data: List[VPNPaymentResponse]
    total: int


# ============ VPN Stats ============

class VPNStatsResponse(BaseModel):
    active_subscriptions: int
    total_subscriptions: int
    expiring_soon: int  # Within 3 days
    new_today: int
    total_revenue_stars: int
    total_revenue_rub: int
    total_payments: int
    # By plan breakdown
    by_plan: dict = {}
    # By protocol breakdown
    by_protocol: dict = {}


# =============================================================================
# Promocode Schemas
# =============================================================================

class PromoGenerateRequest(BaseModel):
    prefix: str = Field(..., min_length=2, max_length=10, description="Code prefix (e.g., 'INSTA')")
    count: int = Field(..., ge=1, le=1000, description="Number of codes to generate")
    days: int = Field(..., ge=1, le=365, description="Days of VPN access")
    traffic_gb: int = Field(0, ge=0, description="Traffic limit in GB (0 = unlimited)")
    max_activations: int = Field(1, ge=1, description="Max activations per code")
    campaign_name: str = Field(..., min_length=1, max_length=255, description="Campaign name")


class PromoCodeResponse(BaseModel):
    id: int
    code: str
    batch_id: Optional[str] = None
    campaign_name: Optional[str] = None
    days: int
    traffic_gb: int
    max_activations: int
    current_activations: int
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PromoBatchResponse(BaseModel):
    batch_id: str
    campaign_name: Optional[str] = None
    codes_count: int
    total_activations: int
    active_codes: int
    created_at: datetime


class PromoGenerateResponse(BaseModel):
    batch_id: str
    codes: list[str]
    count: int
    campaign_name: str
