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
]
