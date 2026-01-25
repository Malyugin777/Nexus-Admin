"""
SQLAlchemy models for Admin API.
Models copied from shared/database/models.py for independence.
"""
from src.models_db import (
    # Enums
    UserRole,
    BotStatus,
    BroadcastStatus,
    SubscriptionProvider,
    BillingCycle,
    SubscriptionStatus,
    APISource,
    # VPN Enums
    VPNPlanType,
    VPNProtocol,
    VPNSubscriptionStatus,
    VPNPaymentStatus,
    VPNPaymentSystem,

    # Models
    Base,
    User,
    Bot,
    BotUser,
    ActionLog,
    AdminUser,
    DownloadError,
    Subscription,
    Broadcast,
    BroadcastLog,
    Segment,
    BotMessage,
    # VPN Models
    VPNSubscription,
    VPNPayment,
    VPNReferral,
)

__all__ = [
    # Enums
    'UserRole',
    'BotStatus',
    'BroadcastStatus',
    'SubscriptionProvider',
    'BillingCycle',
    'SubscriptionStatus',
    'APISource',
    # VPN Enums
    'VPNPlanType',
    'VPNProtocol',
    'VPNSubscriptionStatus',
    'VPNPaymentStatus',
    'VPNPaymentSystem',

    # Models
    'Base',
    'User',
    'Bot',
    'BotUser',
    'ActionLog',
    'AdminUser',
    'DownloadError',
    'Subscription',
    'Broadcast',
    'BroadcastLog',
    'Segment',
    'BotMessage',
    # VPN Models
    'VPNSubscription',
    'VPNPayment',
    'VPNReferral',
]
