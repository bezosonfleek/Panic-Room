# Panic Room (foundation)

1. `cp .env.example .env`, then set `POSTGRES_PASSWORD` (`openssl rand -hex 24`).
   For production set `DOMAIN=yourdomain.com` and `ORIGIN=https://yourdomain.com`.
2. `docker compose up -d --build`
3. Open https://localhost (Caddy uses its own local CA; run `docker compose exec caddy caddy trust` or accept the warning).

Backup: `docker compose exec db pg_dump -U panicroom panicroom > backup.sql`
Restore: `docker compose exec -T db psql -U panicroom panicroom < backup.sql`
Logs: `docker compose logs -f api`
