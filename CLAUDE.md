# CLAUDE.md

## Required Reading

Before starting any work, review these two documents:

1. **`Claude Prompt.md`** — Master governance prompt. Defines the mandatory 4-step workflow (Research → Plan → Implement → Commit), security rules, product requirements, Slack heartbeat spec, and the 10-component response structure. All work must follow this workflow.
2. **`TODO.md`** — Phased task tracker. Shows completed and remaining work. Update this file after completing tasks.

Also check `progress.txt` and `status.json` for session continuity context.

## Project Overview

Client Success Tracker (CST) — a command center dashboard for mastermind coaches to track client progress, manage notes, monitor at-risk clients, and integrate with Slack and Go High Level CRM.

## Architecture

- **Frontend:** React 19 + TypeScript, built with Vite (port 3000)
- **Backend:** Express.js + TypeScript (port 3001)
- **Database:** SQLite via Prisma ORM
- **Auth:** JWT with bcrypt password hashing, RBAC (ADMIN, COACH roles)

The Vite dev server proxies `/api/*` requests to the backend at localhost:3001.

## Directory Structure

```
/                        # Frontend root
├── App.tsx              # Main app component (routing, sidebar)
├── index.tsx            # React mount point
├── types.ts             # TypeScript type definitions
├── lib/api.ts           # API client utilities
├── context/             # React context providers (AuthContext)
├── pages/               # Page components (Dashboard, ClientProfile, Login, AdminUsers)
├── components/ui/       # Reusable UI components (Badge, Card)
└── server/              # Backend
    ├── src/
    │   ├── index.ts     # Express server entry point
    │   ├── middleware/   # auth, rbac, rateLimit, validate, errorHandler, requestLogger
    │   ├── routes/      # RESTful route handlers (auth, users, clients, notes, curriculum, admin, export, slack)
    │   ├── services/    # Business logic (ghl.ts, audit.ts)
    │   └── slack/       # Slack heartbeat and modal templates
    └── prisma/
        ├── schema.prisma  # Database schema
        └── seed.ts        # Database seeding script
```

## Common Commands

### Frontend

```bash
npm install              # Install frontend dependencies
npm run dev              # Start Vite dev server on port 3000
npm run build            # Production build (vite build)
```

### Backend

```bash
cd server
npm install              # Install backend dependencies
npm run dev              # Start dev server with hot-reload (tsx watch)
npm run build            # Compile TypeScript (tsc)
npm run start            # Run compiled production build
npm run test             # Run tests in watch mode (vitest)
npm run test:run         # Run tests once (vitest run)
```

### Database (from server/)

```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run Prisma migrations
npm run db:push          # Push schema to database
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio UI
```

## Key Conventions

- **TypeScript strict mode** is enabled for the backend (`server/tsconfig.json`)
- **Frontend path alias:** `@/*` maps to project root
- **Component naming:** PascalCase for files and components
- **Utility naming:** camelCase for functions and non-component files
- **Enum values:** SCREAMING_SNAKE_CASE (e.g., `AT_RISK`, `NOT_BOOKED`)
- **Database tables:** snake_case via Prisma `@@map()` directives; models are PascalCase
- **API endpoints:** RESTful under `/api/` prefix
- **Input validation:** Zod schemas on all backend route inputs
- **Error handling:** Custom `ApiError` class with centralized error handler middleware
- **Security:** DOMPurify for XSS prevention on frontend; Helmet, CORS, rate limiting on backend
- **Middleware order:** Authentication -> Authorization (RBAC) -> Validation -> Handler

## Environment Variables

Backend env vars are defined in `server/.env.example`. Key variables:
- `DATABASE_URL` — SQLite connection string
- `JWT_SECRET` — Required in production
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID` — Slack integration
- `GHL_API_KEY`, `GHL_LOCATION_ID` — Go High Level CRM sync
- `PORT` — Backend port (default: 3001)
- `NODE_ENV` — `development` or `production`

## Database Schema

Core models: `User`, `Client`, `Note`, `CurriculumStep`, `ClientProgress`, `Outcome`, `AuditLog`, `CustomFieldDef`, `CustomFieldValue`, `ClientTag`

Key enums:
- `ClientStatus`: ONBOARDING, ACTIVE, AT_RISK, COMPLETED, PAUSED
- `OnboardingStatus`: NOT_BOOKED, BOOKED, COMPLETED, NO_SHOW
- `Role`: ADMIN, COACH

## Testing

Tests use Vitest. Run from `server/`:
```bash
npm run test:run         # Single run
npm run test             # Watch mode
```

## Integrations

- **Slack:** Daily heartbeat messages, client selection modals via @slack/bolt
- **Go High Level:** CRM contact sync via REST API
