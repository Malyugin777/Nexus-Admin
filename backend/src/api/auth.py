"""
Auth API endpoints.
"""
import secrets
from datetime import datetime, timedelta
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AdminUser, InviteToken
from ..schemas import (
    LoginRequest, TokenResponse, AdminUserCreate, AdminUserResponse,
    InviteCreate, InviteResponse, InviteListResponse, RegisterByInvite
)
from ..auth import hash_password, verify_password, create_access_token, get_current_user, get_superuser
from ..config import settings

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login and get access token."""
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Update last login
    user.last_login = datetime.utcnow()

    access_token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.post("/login-marzban", response_model=TokenResponse)
async def login_via_marzban(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login via Marzban credentials (SSO)."""
    # Check if Marzban is configured
    if not settings.marzban_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Marzban SSO not configured",
        )

    # 1. Try to authenticate with Marzban
    try:
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            response = await client.post(
                f"{settings.marzban_url.rstrip('/')}/api/admin/token",
                data={"username": data.username, "password": data.password},
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Marzban credentials",
                )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Marzban unavailable: {str(e)}",
        )

    # 2. Check if user exists in our DB
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == data.username)
    )
    user = result.scalar_one_or_none()

    # 3. If not exists - create automatically
    if not user:
        user = AdminUser(
            username=data.username,
            email=f"{data.username}@marzban.local",
            password_hash="marzban_sso",  # Not used for SSO users
            is_superuser=False,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    # 4. Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # 5. Update last login
    user.last_login = datetime.utcnow()

    # 6. Return our JWT token
    access_token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.post("/register", response_model=AdminUserResponse)
async def register(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_superuser),  # Only superusers can create users
):
    """Register new admin user (superuser only)."""
    # Check if username exists
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == data.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    # Check if email exists
    result = await db.execute(
        select(AdminUser).where(AdminUser.email == data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )

    user = AdminUser(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    return user


@router.get("/me", response_model=AdminUserResponse)
async def get_me(
    current_user: AdminUser = Depends(get_current_user),
):
    """Get current user info."""
    return current_user


@router.patch("/me", response_model=AdminUserResponse)
async def update_me(
    email: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """Update current user profile."""
    if email:
        # Check if email already used by another user
        result = await db.execute(
            select(AdminUser).where(
                AdminUser.email == email,
                AdminUser.id != current_user.id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )
        current_user.email = email

    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.post("/me/password")
async def change_password(
    current_password: str,
    new_password: str,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """Change current user password."""
    # Verify current password
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters",
        )

    # Update password
    current_user.password_hash = hash_password(new_password)
    await db.flush()

    return {"message": "Password changed successfully"}


@router.post("/setup", response_model=AdminUserResponse)
async def initial_setup(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Initial setup - create first superuser.
    Only works if no admin users exist.
    """
    result = await db.execute(select(AdminUser).limit(1))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already completed. Admin users exist.",
        )

    user = AdminUser(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        is_superuser=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    return user


# =============================================================================
# Invite Token Endpoints
# =============================================================================

def _format_invite(invite: InviteToken, base_url: str = "") -> InviteResponse:
    """Format invite token for response."""
    now = datetime.utcnow()
    return InviteResponse(
        id=invite.id,
        token=invite.token,
        email=invite.email,
        role=invite.role,
        created_by=invite.created_by,
        expires_at=invite.expires_at,
        used_at=invite.used_at,
        used_by=invite.used_by,
        created_at=invite.created_at,
        is_expired=invite.expires_at < now,
        is_used=invite.used_at is not None,
        invite_url=f"{base_url}/register?token={invite.token}" if base_url else None,
    )


@router.get("/invites", response_model=InviteListResponse)
async def list_invites(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_user),
):
    """List all invite tokens."""
    result = await db.execute(
        select(InviteToken).order_by(InviteToken.created_at.desc())
    )
    invites = result.scalars().all()

    # Get base URL for invite links
    base_url = str(request.base_url).rstrip("/")

    return InviteListResponse(
        data=[_format_invite(inv, base_url) for inv in invites],
        total=len(invites),
    )


@router.post("/invites", response_model=InviteResponse)
async def create_invite(
    request: Request,
    data: InviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """Create new invite token (24h expiry)."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)

    invite = InviteToken(
        token=token,
        email=data.email,
        role=data.role,
        created_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)

    base_url = str(request.base_url).rstrip("/")
    return _format_invite(invite, base_url)


@router.delete("/invites/{invite_id}")
async def delete_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_user),
):
    """Delete/revoke invite token."""
    result = await db.execute(
        select(InviteToken).where(InviteToken.id == invite_id)
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    await db.delete(invite)
    return {"message": "Invite deleted"}


@router.post("/register-invite", response_model=AdminUserResponse)
async def register_by_invite(
    data: RegisterByInvite,
    db: AsyncSession = Depends(get_db),
):
    """Register new admin user using invite token."""
    # Find and validate invite
    result = await db.execute(
        select(InviteToken).where(InviteToken.token == data.token)
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite token",
        )

    if invite.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite token already used",
        )

    if invite.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite token expired",
        )

    # If invite has pre-set email, enforce it
    if invite.email and invite.email.lower() != data.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This invite is for {invite.email}",
        )

    # Check if username exists
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == data.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    # Check if email exists
    result = await db.execute(
        select(AdminUser).where(AdminUser.email == data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )

    # Create user
    user = AdminUser(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        is_superuser=(invite.role == "superuser"),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Mark invite as used
    invite.used_at = datetime.utcnow()
    invite.used_by = user.id

    return user


@router.get("/invite-check/{token}")
async def check_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Check if invite token is valid (public endpoint for register page)."""
    result = await db.execute(
        select(InviteToken).where(InviteToken.token == token)
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite token",
        )

    if invite.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite token already used",
        )

    if invite.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite token expired",
        )

    return {
        "valid": True,
        "email": invite.email,
        "role": invite.role,
    }


# =============================================================================
# Marzban Admin Management Endpoints
# =============================================================================

from ..marzban_api import marzban_api, MarzbanAPIError
from pydantic import BaseModel


class MarzbanAdminCreate(BaseModel):
    username: str
    password: str
    is_sudo: bool = False


@router.get("/marzban-admins")
async def list_marzban_admins(
    _: AdminUser = Depends(get_current_user),
):
    """List all Marzban admins."""
    if not marzban_api.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Marzban not configured",
        )

    try:
        admins = await marzban_api.get_admins()
        return {"admins": admins}
    except MarzbanAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Marzban error: {e.message}",
        )


@router.post("/marzban-admins")
async def create_marzban_admin(
    data: MarzbanAdminCreate,
    _: AdminUser = Depends(get_current_user),
):
    """Create a new admin in Marzban."""
    if not marzban_api.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Marzban not configured",
        )

    try:
        result = await marzban_api.create_admin(
            username=data.username,
            password=data.password,
            is_sudo=data.is_sudo,
        )
        return {"success": True, "admin": result}
    except MarzbanAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create admin: {e.message}",
        )


@router.delete("/marzban-admins/{username}")
async def delete_marzban_admin(
    username: str,
    _: AdminUser = Depends(get_current_user),
):
    """Delete an admin from Marzban."""
    if not marzban_api.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Marzban not configured",
        )

    try:
        await marzban_api.delete_admin(username)
        return {"success": True, "message": f"Admin {username} deleted"}
    except MarzbanAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete admin: {e.message}",
        )
