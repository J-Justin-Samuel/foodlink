# FoodLink — Stage 1 (src/ layout)

## Folder structure

```
foodlink/
├── src/
│   ├── app/
│   │   ├── onboarding/
│   │   │   ├── actions.ts                 # Server Actions (role select, operational details)
│   │   │   ├── page.tsx                    # 2-step wizard
│   │   │   ├── pending/page.tsx
│   │   │   └── components/
│   │   │       ├── role-select-step.tsx
│   │   │       └── operational-details-step.tsx
│   │   └── unauthorized/page.tsx
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   ├── seed.ts
│   │   └── migrations/
│   │       ├── 0000_enable_postgis.sql
│   │       └── 0001_foodlink_init.sql
│   ├── lib/
│   │   └── rbac.ts
│   ├── types/
│   │   ├── roles.ts
│   │   └── globals.d.ts
│   └── middleware.ts
├── drizzle.config.ts        # stays at repo root — points into src/db
├── tsconfig.json            # @/* → ./src/*
├── package.json
└── .env.example
```

This matches what `create-next-app --src-dir --import-alias "@/*"` scaffolds. No import paths changed from the previous version — everything already used the `@/...` alias, and that alias now resolves into `src/` instead of the repo root.

`app/`, `middleware.ts` inside `src/`, and `drizzle.config.ts`/`tsconfig.json`/`package.json`/`.env.example` at the repo root is the standard split: routing + server code under `src/`, tooling config at root where each tool expects to find it.

## Setup — copy/paste in order

```bash
# 1. Scaffold the real Next.js project (this creates node_modules, next.config.js,
#    app/layout.tsx, globals.css, etc. that aren't part of this zip)
npx create-next-app@latest foodlink \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd foodlink

# 2. Unzip this deliverable and overwrite the generated src/, plus drop in the
#    root-level config files (say yes to overwriting tsconfig.json)
unzip ~/Downloads/foodlink-stage1-src.zip -d .

# 3. Install Stage 1 dependencies
npm install @clerk/nextjs drizzle-orm postgres zod
npm install -D drizzle-kit tsx

# 4. Add shadcn/ui + the components the onboarding form imports
npx shadcn@latest init
npx shadcn@latest add card button input label

# 5. Start Postgres with PostGIS (Docker)
docker run --name foodlink-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=foodlink \
  -p 5432:5432 \
  -d postgis/postgis:16-3.4

# 6. Environment variables
cp .env.example .env.local
# edit .env.local:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/foodlink"
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=... / CLERK_SECRET_KEY=...  (from dashboard.clerk.com)

# 7. Run migrations — 0000 MUST run before 0001 (enables the postgis extension first)
docker exec -i foodlink-db psql -U postgres -d foodlink < src/db/migrations/0000_enable_postgis.sql
docker exec -i foodlink-db psql -U postgres -d foodlink < src/db/migrations/0001_foodlink_init.sql

# 8. Seed mock donor/volunteer/NGO/buyer/admin + one sample donation
npm run db:seed

# 9. Run it
npm run dev
```

Open `http://localhost:3000/onboarding` — that's the flow this stage actually builds toward.

## If step 2's unzip overwrites files you don't want touched

`create-next-app` generates its own `tsconfig.json`, `package.json`, and `src/app/page.tsx` / `layout.tsx` / `globals.css`. Unzipping this on top will:

- **Replace** `tsconfig.json` and `package.json` — intentional, they're pre-configured for this stage (paths alias, scripts).
- **Not touch** `layout.tsx`, `globals.css`, or the default `page.tsx` — this zip doesn't include them, so your scaffolded versions survive untouched.
- **Add** everything under `src/app/onboarding`, `src/app/unauthorized`, `src/db`, `src/lib`, `src/types`, `src/middleware.ts` as new files.

If `npm install` complains about package.json being replaced mid-setup, just re-run `npm install` after — it's idempotent.

## Everything else

Same design notes as before (geography custom type via raw SQL, dual RBAC enforcement at middleware + Server Action level, role/status mirrored into Clerk metadata) — see the inline comments in `src/lib/rbac.ts`, `src/middleware.ts`, and `src/app/onboarding/actions.ts`.

Still deferred to later stages: Route Handlers for machine-to-machine traffic (ESP32 ingest, Clerk/Stripe webhooks), admin verification UI, real shadcn component installs.
