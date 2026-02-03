# System Architecture

## Overview

Nexus Admin — единый центр управления VPN ботом и другими Telegram ботами.

## Servers

### NL Exit Node (Hostkey) — 82.24.110.167
**Role:** Workhorse

| Service | Port | Description |
|---------|------|-------------|
| Xray | 443 | VLESS Reality (VPN traffic) |
| Marzban | 8000 | VPN panel (https://vpn.shadow-api.ru:8000/dashboard/) |
| VPN Bot | — | Docker container `vpn_bot` |
| GOST Receiver | 9443 | relay+tls (принимает трафик от RU relay) |

**SSH:** root (ключ в GitHub Secrets)
**Path:** `/root/TelegramVPN/`

### RU Relay (Aeza Moscow) — 85.192.30.123
**Role:** Gateway для российских юзеров

| Service | Port | Description |
|---------|------|-------------|
| GOST Relay | 443 | TCP → relay+tls://82.24.110.167:9443 |

**SSH:** root / 1i3TjpUnE3Hw
**Path:** `/root/gost/`

### RU Brain (Aeza) — 185.96.80.254
**Role:** Database & Admin Panel

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | nexus_postgres container |
| Redis | 6379 | nexus_redis container |
| Admin API | 8000 | admin_api container |
| Admin Frontend | 443 | https://shadow-api.ru |

**SSH:** root / Rebirth1618!

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPN TRAFFIC                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User (RU)                                                                  │
│      │                                                                      │
│      ▼                                                                      │
│  85.192.30.123:443 (GOST Relay)                                            │
│      │                                                                      │
│      │ relay+tls tunnel                                                     │
│      ▼                                                                      │
│  82.24.110.167:9443 (GOST Receiver)                                        │
│      │                                                                      │
│      ▼                                                                      │
│  127.0.0.1:443 (Xray/Marzban)                                              │
│      │                                                                      │
│      ▼                                                                      │
│  Internet (NL exit)                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VPN Bot (82.24.110.167)  ──────────────►  PostgreSQL (185.96.80.254:5432) │
│                                                                             │
│  Admin Panel (185.96.80.254) ───────────►  PostgreSQL (185.96.80.254:5432) │
│                                                                             │
│  Marzban (82.24.110.167:8000) ──────────►  SQLite (local)                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Credentials

| Service | Credentials |
|---------|-------------|
| Marzban Panel | admin / VpnAdmin2025! |
| PostgreSQL | nexus / nexus_secure_pwd_2024 / nexus_db |
| Admin Panel | admin / Admin123 |
| JWT Secret | super_secret_jwt_key_change_in_production_2024 |

## Repositories

| Repo | Server | Deploy |
|------|--------|--------|
| TelegramVPN | 82.24.110.167 | git push → GitHub Actions |
| nexus-admin | 185.96.80.254 | git push → GitHub Actions |

## Docker Containers

### NL Server (82.24.110.167)
```
vpn_bot           — Telegram VPN Bot (aiogram)
marzban-marzban-1 — Marzban Panel
marzban-xray-1    — Xray Core
gost-relay        — GOST receiver
```

### RU Relay (85.192.30.123)
```
gost-relay        — GOST forwarder
```

### Aeza Brain (185.96.80.254)
```
nexus_postgres    — PostgreSQL 15
nexus_redis       — Redis 7
admin_api         — FastAPI backend
admin_frontend    — React frontend (nginx)
```

## Useful Commands

```bash
# Check VPN bot logs
ssh root@82.24.110.167 "docker logs vpn_bot --tail 50"

# Check admin API logs
ssh root@185.96.80.254 "docker logs admin_api --tail 50"

# Query database
ssh root@185.96.80.254 "docker exec nexus_postgres psql -U nexus -d nexus_db -c 'SELECT * FROM vpn_subscriptions;'"

# Restart services
ssh root@82.24.110.167 "cd /root/TelegramVPN/infrastructure && docker compose restart vpn_bot"
ssh root@185.96.80.254 "docker restart admin_api"
```
