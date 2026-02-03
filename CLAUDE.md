# NEXUS-ADMIN - ПРАВИЛА

## Назначение
Admin Panel для SaveNinja Bot (@SaveNinja_bot) и других ботов.

## Сервер
- **Aeza:** 185.96.80.254 (SSH: root / Rebirth1618!)
- **Путь:** /root/nexus-admin/
- **Домен:** shadow-api.ru (frontend), api.shadow-api.ru (backend)

## Деплой

### ТОЛЬКО git push!
```bash
git add -A && git commit -m "msg" && git push
# GitHub Actions автоматически деплоит на Aeza
```

### НЕ ДЕЛАТЬ:
- ssh для деплоя кода
- scp для копирования файлов
- docker compose up через ssh

### РАЗРЕШЕНО ssh только для:
- Просмотр логов
- Экстренный рестарт
- Отладка

## База данных (общая с ботами)
- **PostgreSQL:** nexus / nexus_secure_pwd_2024 @ nexus_postgres:5432
- **Redis:** nexus_redis:6379
- **Network:** infrastructure_nexus_network

## Частые команды
```bash
# Логи backend
ssh root@185.96.80.254 "docker logs admin_api --tail 50"

# Перезапуск
ssh root@185.96.80.254 "docker restart admin_api"

# Статус контейнеров
ssh root@185.96.80.254 "docker ps"

# Проверить БД
ssh root@185.96.80.254 "docker exec nexus_postgres psql -U nexus -d nexus_db -c 'SELECT COUNT(*) FROM users'"
```

## Структура проекта
```
nexus-admin/
├── backend/
│   ├── src/
│   │   ├── api/           # FastAPI роуты
│   │   ├── models.py      # Импорт моделей
│   │   ├── models_db.py   # SQLAlchemy модели (копия из shared)
│   │   └── main.py        # Entry point
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/         # React страницы
│   │   └── App.tsx
│   └── package.json
└── .github/workflows/
    └── deploy.yml         # Автодеплой
```

## Secrets (локальное хранилище)
Каталог `secrets/` (в .gitignore) — хранилище паролей и ключей:
- `secrets/hostkey.txt` — Hostkey VPN Server (NL)

## Связанные проекты
- **TelegramVPN** (C:\Projects\TelegramVPN) — VPN бот, Hostkey NL сервер (82.24.110.167)
- **TelegramBots** (боты) - Hostkey сервер (66.151.33.167)
- Используют ту же БД через внешнее подключение

## Credentials
| Что | Значение |
|-----|----------|
| Админка | admin / Admin123 |
| JWT Secret | super_secret_jwt_key_change_in_production_2024 |

## GitHub Secrets
| Secret | Value |
|--------|-------|
| AEZA_HOST | 185.96.80.254 |
| AEZA_USER | root |
| AEZA_PASSWORD | Rebirth1618! |
