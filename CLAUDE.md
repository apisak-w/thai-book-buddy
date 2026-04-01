# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Thai Book Buddy — a LINE LIFF web app for Thai book fair visitors to track publishers, wishlist books, and find booth locations.

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Supabase + LINE LIFF

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build (also type-checks)
npm run lint         # ESLint
supabase start       # Local Supabase (run from repo root)
supabase db push     # Deploy migrations to cloud
```

No test framework is configured.

## Architecture

### Auth Flow (spans multiple files)

1. `providers/liff-providers.tsx` — LIFF SDK init (10s timeout) → LINE login → call Supabase edge function `auth-line` → exchange token_hash via `verifyOtp` → check profile for onboarding
2. `supabase/functions/auth-line/index.ts` — Deno edge function that verifies LINE access token, creates/finds Supabase user, returns magic-link token_hash
3. Dev bypass: `NODE_ENV === "development" && NEXT_PUBLIC_DEV_BYPASS_AUTH === "true"` skips LIFF entirely (checked in liff-providers.tsx and my-list/page.tsx)

### Pages

All pages are `"use client"` (LIFF + Supabase auth dependency). React Compiler is enabled (`next.config.ts`) for automatic memoization.

- `/` — Login gate + onboarding form
- `/browse` — Publisher list with search/zone filter, wishlist toggle
- `/map` — Zoomable SVG booth map
- `/my-list` — Wishlist detail: books per publisher, purchase tracking, notes
- `/admin` — Analytics dashboard, password-gated via `x-admin-password` header checked against `ADMIN_PASSWORD` env var

### API Routes

- `GET /api/publishers` — All publishers + booths (in-memory cache, 1hr TTL)
- `GET /api/admin/data` — Dashboard analytics (rate-limited, admin-only)
- `GET /api/admin/publisher/[id]` — Publisher detail + demographics (rate-limited, admin-only)
- Admin rate limiting: `app/api/admin/rate-limit.ts` — 5 failed attempts per IP per 5 minutes

### Database (Supabase PostgreSQL)

Core tables: `profiles` (age, gender, display_name), `publishers` (name_th, name_en, category[]), `booths` (zone, booth_number, x/y coords), `user_selections` (wishlist), `user_books` (title, price, is_purchased), `sessions` (DAU tracking).

RPC functions (defined in migrations): `admin_get_publisher_stats`, `admin_get_dau`, `admin_get_top_books`, `admin_get_global_demographics`, `admin_get_publisher_demographics`.

RLS: Public read for publishers/booths; users can only modify their own data.

### State Management

- `LIFFContext` (providers/liff-providers.tsx) — auth state, LIFF object, login status, onboarding flag
- Each page manages its own local state (no state management library)
- localStorage: onboarding flag, publishers cache (1hr), dismissals
- `utils/supabase.ts` — singleton Supabase client

## Environment Variables

**Required** (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client config
- `SUPABASE_SERVICE_ROLE_KEY` — Admin key for API routes (server-only)
- `NEXT_PUBLIC_LIFF_ID` — LINE LIFF app ID
- `ADMIN_PASSWORD` — Password for admin API endpoints

**Optional**:
- `NEXT_PUBLIC_DEV_BYPASS_AUTH` — Skip LIFF auth in development
- `NEXT_PUBLIC_DONATE_BANNER_ENABLED` — Show donation banner

## Workflow

Before starting any new work (feature, bugfix, etc.), always create a new git worktree with a new branch. Never work directly on `main`.

## Conventions

- **Timeouts**: All critical async ops use `withTimeout(promise, ms, msg)` helper (10-15s). LIFF init has a separate 10s `Promise.race`.
- **Preview mode**: `?preview=1` query string on `/browse` and `/map` loads mock data without auth.
- **Inline Tailwind colors**: Uses literal hex values in className (e.g. `text-[#c4855a]`), not theme tokens.
- **Thai text**: UI is primarily Thai. Publisher names have both `name_th` (required) and `name_en` (nullable).
- **Optimistic updates**: Wishlist toggles and book deletions update UI immediately, then write to DB. Undo via toast with 4s timer.
- **Fonts**: Literata (serif headings), Plus Jakarta Sans (numbers), Sarabun (Thai body text) — loaded via `next/font` in `app/layout.tsx`.
