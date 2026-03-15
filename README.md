# Editorial — AI-powered Editorial Platform

Immigration & legal news aggregation with AI-driven article creation.

## Features

- **Data Collectors** — automated news harvesting from OECD, UN, Congress, NewsData APIs
- **Publications Kanban** — visual workflow: Raw → Draft → Review → Approved → Published
- **Articles System** — tab-based editorial workflow with AI at every stage
- **AI Autopilot** — GPT-4o-mini grouping, outline, draft, review
- **Cover Generation** — DALL-E 3 or manual upload
- **Distribution** — Telegram, Twitter, Website channels with retry on errors
- **Admin Dashboard** — full-featured web UI at `/dashboard/`

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Strorry002/editorial.git
cd editorial

# 2. Configure
cp .env.example .env
# Edit .env — set OPENAI_API_KEY (required for AI features)

# 3. Run with Docker
docker compose up -d

# 4. Initialize DB
docker compose exec app npx prisma db push
docker compose exec app npx tsx src/seed/index.ts

# 5. Open
# Dashboard: http://localhost:4100/dashboard/
# API: http://localhost:4100/api/v1/
```

## Local Development

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
# → http://localhost:4100/dashboard/
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes* | GPT-4o-mini + DALL-E 3 (*for AI features) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot for distribution |
| `CONGRESS_API_KEY` | No | US Congress API |
| `NEWSDATA_API_KEY` | No | NewsData.io API |
| `AUTOPILOT_ENABLED` | No | Enable daily autopilot (default: true) |
| `AUTOPILOT_CRON` | No | Cron schedule (default: 0 11 * * *) |

## Architecture

```
src/
  server.ts          — Fastify server + plugin registration
  routes/
    articles.ts      — Articles CRUD + AI endpoints
    publications.ts  — Publications kanban + distributions
    admin.ts         — Overview + logs
    countries.ts     — Country data
    feed.ts          — Public feed
  services/
    ai.ts            — OpenAI integration (GPT-4o-mini, DALL-E 3)
    autopilot.ts     — AI news grouping, outline, draft, review
  collectors/        — Data harvesting scripts
  bot/               — Telegram bot
  seed/              — Database seeding
public/
  dashboard/         — Admin UI (HTML + CSS + JS)
prisma/
  schema.prisma      — Database schema
```

## Deployment

```bash
# On server:
git pull
docker compose down
docker compose up -d --build
docker compose exec app npx prisma db push
```
