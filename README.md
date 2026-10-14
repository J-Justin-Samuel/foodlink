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

# FoodLink — Stage 2: Donation Intake & Geospatial Matching

Copy everything in this zip over your project root (same `src/` layout as Stage 1).
**Two Stage 1 files are replaced** — say yes to overwrite:

- `src/db/schema.ts` — adds the Stage 2 columns **and fixes a bug in Stage 1**: the
  PostGIS `customType` ended with an invalid `.default(...)` call that would crash
  as soon as the schema was imported.
- `src/db/seed.ts` — the sample donation is now marked `CLAIMED` (it already had a
  volunteer assigned, so it shouldn't show up as available).

## Setup, in order

**0. Prerequisite:** PostGIS installed and migrations `0000` + `0001` already run in pgAdmin.

**1. Install packages**

```powershell
npm install react-hook-form @hookform/resolvers mapbox-gl
```

**2. Add the new database columns (pgAdmin)**
Open the `foodlink` database → Query Tool → paste the contents of
`src/db/migrations/0002_stage2_donation_intake.sql` → press F5. Run it **once**.

**3. Add a seed script to `package.json`** (inside `"scripts"`):

```json
"db:seed:donations": "tsx src/db/seed-donations.ts"
```

**4. Mapbox token**
Create a free account at account.mapbox.com → Tokens → copy the default **public** token
(starts with `pk.`). Add to `.env.local`, then restart `npm run dev`:

```
NEXT_PUBLIC_MAPBOX_TOKEN="pk.eyJ1..."
```

**5. Clerk: expose the role to middleware** (this was missing from Stage 1 — without it
every role page redirects to /unauthorized)
Clerk Dashboard → Configure → Sessions → **Customize session token**, set:

```json
{ "metadata": "{{user.public_metadata}}" }
```

**6. Test data**

```powershell
npm run db:seed              # Stage 1 users (skip if already run)
npm run db:seed:donations    # 8 test donations around Bengaluru
```

## Trying it out

1. Sign up → onboarding as **Donor** → `/donor/donations/new` → list a batch
   (type an address and pick a suggestion — that is what produces the latitude/longitude).
2. Sign out, sign up a second account → onboarding as **Volunteer** (GPS is captured) →
   `/volunteer/discover`. Pins are red (urgent), amber (soon), green (relaxed);
   numbers match the card order.
3. Click a card to expand it, then **Claim pickup**. After onboarding, if you land on
   /unauthorized, sign out and back in so the session picks up your role.

## What was verified

Run against a real PostgreSQL 16 + PostGIS database with Next 16 and Zod 4:
all three migrations apply; the whole project typechecks; `next build` succeeds;
the Server Actions were exercised directly:

- Matching returns only `LISTED`, unexpired donations inside the radius, sorted by
  `10/max(hours,0.5) + 10/max(km,1)`; SQL scores equal an independent recompute.
- Classification and expiry filters, input validation and role checks behave.
- Created donations store the point as (lng, lat) correctly, with 6-digit OTPs.
- **8 volunteers claiming the same batch at once → exactly 1 wins**, the rest get a
  "already claimed" error. With the row locks removed the same test lets all 8 win,
  so the test does detect the race.
- A volunteer can't exceed 3 active pickups even with simultaneous claims.

**Not tested in a browser:** the Mapbox map/pin rendering, address autocomplete and
the Clerk sign-in flow (they need your real keys). If something looks off there, send me a screenshot.

## Things to know

- **Distance is straight-line**, not driving distance. `ST_Distance` can't know about roads.
  Real driving distance means calling Mapbox's Directions/Matrix API for the top results —
  an easy upgrade later.
- Donors with onboarding status `SUBMITTED` may list food for now. Tighten
  `ALLOWED_ONBOARDING` in `src/lib/actions/donations.ts` once Stage 6 admin approval exists.
- The list refreshes every 60 s; true real-time push comes with Pusher/Ably later.
- Next 16 warns that `middleware.ts` is renamed `proxy.ts`. It still works; migrate any
  time with `npx @next/codemod@canary middleware-to-proxy .`
- If TypeScript complains about `mapbox-gl` types: `npm install -D @types/mapbox-gl`.

## File map

| File                                               | Purpose                                                 |
| -------------------------------------------------- | ------------------------------------------------------- |
| `db/migrations/0002_*.sql`                         | classification enum, intake columns, claim unique index |
| `db/schema.ts`                                     | updated schema (+ geography type fix)                   |
| `db/seed-donations.ts`                             | test donations                                          |
| `lib/validations/donation.ts`                      | Zod schemas shared by form and server                   |
| `lib/actions/donations.ts`                         | `createDonation`                                        |
| `lib/actions/matching.ts`                          | `findNearbyDonations` (PostGIS query + urgency rank)    |
| `lib/actions/claims.ts`                            | `claimDonation` (transaction + `FOR UPDATE`)            |
| `lib/urgency.ts`, `lib/action-utils.ts`, `types/*` | helpers and shared types                                |
| `components/shared/address-search.tsx`             | Mapbox geocoding autocomplete                           |
| `components/shared/discovery-map.tsx`              | Mapbox canvas with urgency pins                         |
| `app/donor/donations/new/*`                        | donation form (React Hook Form + Zod)                   |
| `app/volunteer/discover/*`                         | map + filterable card list + claim                      |
| `app/sign-in`, `app/sign-up`                       | Clerk pages (missing in Stage 1)                        |
