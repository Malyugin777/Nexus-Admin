"""
Marzban API client for VPN user management.
Based on VPN bot implementation.
"""
import logging
from typing import Optional
from datetime import datetime, timedelta

import httpx

from .config import settings

logger = logging.getLogger(__name__)


class MarzbanAPIError(Exception):
    """Marzban API error."""
    def __init__(self, message: str, status_code: int = 0):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class MarzbanAPI:
    """Async client for Marzban API."""

    def __init__(
        self,
        base_url: str = None,
        username: str = None,
        password: str = None,
    ):
        self.base_url = (base_url or settings.marzban_url).rstrip("/")
        self.username = username or settings.marzban_username
        self.password = password or settings.marzban_password
        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    def is_configured(self) -> bool:
        """Check if Marzban API is configured."""
        return bool(self.base_url and self.username and self.password)

    async def _get_token(self) -> str:
        """Get or refresh JWT token."""
        if self._token and self._token_expires and datetime.now() < self._token_expires:
            return self._token

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/admin/token",
                data={
                    "username": self.username,
                    "password": self.password,
                },
            )
            if response.status_code != 200:
                raise MarzbanAPIError(
                    f"Failed to get token: {response.text}",
                    response.status_code
                )
            data = response.json()
            self._token = data["access_token"]
            # Token expires in 24h, refresh after 23h
            self._token_expires = datetime.now() + timedelta(hours=23)
            return self._token

    async def _request(
        self,
        method: str,
        endpoint: str,
        json: dict = None,
        params: dict = None,
    ) -> dict:
        """Make authenticated request to Marzban API."""
        token = await self._get_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                f"{self.base_url}{endpoint}",
                headers=headers,
                json=json,
                params=params,
            )
            if response.status_code >= 400:
                error_text = response.text
                logger.error(f"Marzban API error: {response.status_code} - {error_text}")
                raise MarzbanAPIError(error_text, response.status_code)
            return response.json()

    async def create_user(
        self,
        username: str,
        data_limit_gb: int = 0,  # 0 = unlimited
        expire_days: int = 30,
        protocol: str = "vless",
    ) -> dict:
        """
        Create a new VPN user in Marzban.

        Args:
            username: Unique username (e.g., "vpn_12345678")
            data_limit_gb: Traffic limit in GB (0 = unlimited)
            expire_days: Days until expiration
            protocol: Protocol to use ("vless" or "shadowsocks")

        Returns:
            User data with links and subscription_url
        """
        data_limit_bytes = data_limit_gb * 1024 * 1024 * 1024 if data_limit_gb > 0 else 0
        expire_timestamp = int((datetime.now() + timedelta(days=expire_days)).timestamp())

        # Configure proxies and inbounds based on protocol
        if protocol == "shadowsocks":
            proxies = {"shadowsocks": {}}
            inbounds = {"shadowsocks": ["Shadowsocks TCP"]}
        else:
            # Default: VLESS Reality (best for DPI bypass)
            proxies = {"vless": {"flow": "xtls-rprx-vision"}}
            inbounds = {"vless": ["VLESS TCP Reality"]}

        payload = {
            "username": username,
            "proxies": proxies,
            "inbounds": inbounds,
            "data_limit": data_limit_bytes,
            "expire": expire_timestamp,
            "data_limit_reset_strategy": "no_reset",
            "status": "active",
        }

        logger.info(f"Creating Marzban user: {username}, {data_limit_gb}GB, {expire_days}d")
        return await self._request("POST", "/api/user", json=payload)

    async def get_user(self, username: str) -> dict:
        """Get user info from Marzban."""
        return await self._request("GET", f"/api/user/{username}")

    async def get_subscription_url(self, username: str) -> str:
        """Get subscription URL for user."""
        user = await self.get_user(username)
        return user.get("subscription_url", "")

    async def extend_user(self, username: str, days: int) -> dict:
        """Extend user subscription by N days (smart logic)."""
        user = await self.get_user(username)
        current_expire = user.get("expire", 0)

        now = datetime.now()
        if current_expire == 0 or current_expire < now.timestamp():
            # No expiration or expired — start from now
            new_expire = int((now + timedelta(days=days)).timestamp())
        else:
            # Active — extend from current expiration
            new_expire = current_expire + (days * 24 * 60 * 60)

        # Also reactivate if was disabled
        return await self._request(
            "PUT",
            f"/api/user/{username}",
            json={"expire": new_expire, "status": "active"}
        )

    async def reset_traffic(self, username: str) -> dict:
        """Reset user's used traffic."""
        return await self._request("POST", f"/api/user/{username}/reset")

    async def disable_user(self, username: str) -> dict:
        """Disable (deactivate) user."""
        return await self._request(
            "PUT",
            f"/api/user/{username}",
            json={"status": "disabled"}
        )

    async def enable_user(self, username: str) -> dict:
        """Enable (activate) user."""
        return await self._request(
            "PUT",
            f"/api/user/{username}",
            json={"status": "active"}
        )

    async def delete_user(self, username: str) -> dict:
        """Delete user from Marzban."""
        return await self._request("DELETE", f"/api/user/{username}")


# Singleton instance
marzban_api = MarzbanAPI()
