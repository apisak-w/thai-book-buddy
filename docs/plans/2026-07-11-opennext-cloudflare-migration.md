# OpenNext → Cloudflare Workers Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Thai Book Buddy off Vercel onto Cloudflare Workers using the official OpenNext adapter, keeping the real Next.js toolchain, gaining true scale-to-zero economics for the app's two seasonal book-fair bursts, and removing all Vercel-specific coupling.

**Architecture:** `@opennextjs/cloudflare` wraps the normal `next build` output and runs it as a single Cloudflare Worker, with static assets served free by Cloudflare Assets. No application logic is rewritten. The three API routes, all `"use client"` pages, `next/font`, React Compiler, and the Supabase + LINE LIFF client SDKs are carried over unchanged. Vercel-specific bits (a 3-header `vercel.json`, a CI deploy-hook curl) are replaced with host-agnostic equivalents. One Supabase edge-function CORS allowlist must be updated for the new origin.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · `@opennextjs/cloudflare` · Wrangler · Cloudflare Workers · Supabase · LINE LIFF · GitHub Actions

---

## Why this path (context for the engineer)

This app has an unusually small server surface. There is **no** `middleware.ts`, **no** Edge runtime (`export const runtime = "edge"`), no ISR/`revalidate`, no Server Actions, no `next/image` optimization. Every page is `"use client"`; `next.config.ts` is one line. The only server code is three thin API route handlers that proxy Supabase. That is exactly the profile OpenNext handles cleanly, and it avoids the adapter's only two hard gaps (Node Middleware and the Edge runtime).

**Two facts that shape this plan:**
1. The admin API routes already create the `supabase-js` client **per request** (inside `adminClient()`), so the Cloudflare "Cannot perform I/O on behalf of a different request" persistent-connection error does **not** apply. No refactor needed there.
2. The `auth-line` Supabase edge function hardcodes a CORS allowlist of the two Vercel domains. Moving origins **will** break LINE login unless the new origin is added (Task 9).

---

## Prerequisites (do before Task 1)

- **Isolated worktree/branch.** This plan must be executed on its own branch in a fresh worktree (created via `superpowers:using-git-worktrees`), not the research branch. Suggested branch: `feat/opennext-cloudflare`.
- **`.env.local` present in the execution worktree** with all five required vars (the research worktree does not have one):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIFF_ID` (build-time, inlined into the client bundle)
  - `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` (server-side; needed at build for `@t3-oss/env-nextjs` validation and at runtime as Worker secrets)
- **A Cloudflare account** with Workers enabled, plus a scoped **API token** (permissions: *Workers Scripts: Edit*, *Account Settings: Read*) and the **Account ID**. Store both as GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for Task 11.
- **Access to** the LINE Developers Console (to change the LIFF Endpoint URL), the Supabase dashboard (Auth URL config), and the Supabase project's edge functions (to redeploy `auth-line`).

> **Version note:** OpenNext config field names and required `compatibility_date` shift release-to-release. The exact file contents below are correct for a recent `@opennextjs/cloudflare` (v1.x). If `opennextjs-cloudflare build` errors on a config field, reconcile against the current docs at https://opennext.js.org/cloudflare before improvising — do not guess field names.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `@opennextjs/cloudflare` + `wrangler` dev deps; add `preview`/`deploy`/`cf-typegen` scripts |
| `open-next.config.ts` | Create | OpenNext adapter config (Cloudflare preset) |
| `wrangler.jsonc` | Create | Worker name, entry point, `nodejs_compat`, static-assets binding |
| `.gitignore` | Modify | Ignore `.open-next/`, `.dev.vars`, generated `cloudflare-env.d.ts` |
| `.dev.vars` | Create (git-ignored) | Local runtime server secrets for `opennextjs-cloudflare preview` |
| `next.config.ts` | Modify | Add host-agnostic security `headers()` (replacing `vercel.json`) |
| `vercel.json` | Delete | Vercel-only; replaced by `next.config.ts` headers |
| `app/layout.tsx` | Modify (optional) | Remove vestigial `x-nonce`/`headers()` dead code |
| `.github/workflows/deploy-staging.yml` | Modify | Replace Vercel deploy-hook curl with Cloudflare build + deploy |
| `supabase/functions/auth-line/index.ts` | Modify | Add the new Cloudflare origin(s) to the CORS allowlist |

No changes to: the three `app/api/**` route handlers, any page, `utils/`, `providers/`, or DB migrations.

---

## Task 1: Add OpenNext + Wrangler dependencies

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install the adapter and Wrangler as dev dependencies**

```bash
npm install --save-dev @opennextjs/cloudflare@latest wrangler@latest
```

- [ ] **Step 2: Verify they were added**

Run: `npm ls @opennextjs/cloudflare wrangler --depth=0`
Expected: both listed with resolved versions, no `UNMET DEPENDENCY`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @opennextjs/cloudflare and wrangler dev deps"
```

---

## Task 2: Create the OpenNext adapter config

**Files:**
- Create: `open-next.config.ts`

- [ ] **Step 1: Create `open-next.config.ts` at the repo root**

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache / KV needed: this app has no ISR and no `revalidate`.
// Add an `incrementalCache` (e.g. R2/KV) here only if ISR is introduced later.
export default defineCloudflareConfig();
```

- [ ] **Step 2: Type-check the config compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `open-next.config.ts`. (If `defineCloudflareConfig` is not found, the package version differs — check the current export name in `node_modules/@opennextjs/cloudflare`.)

- [ ] **Step 3: Commit**

```bash
git add open-next.config.ts
git commit -m "feat: add OpenNext Cloudflare adapter config"
```

---

## Task 3: Create the Wrangler config

**Files:**
- Create: `wrangler.jsonc`

- [ ] **Step 1: Create `wrangler.jsonc` at the repo root**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "thai-book-buddy",
  "main": ".open-next/worker.js",
  // nodejs_compat is REQUIRED by OpenNext; compatibility_date must be recent
  // enough to enable it (>= 2024-09-23). Bump to today's date when executing.
  "compatibility_date": "2025-03-25",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

- [ ] **Step 2: Validate Wrangler can parse it**

Run: `npx wrangler --version && npx wrangler deploy --dry-run --outdir=.wrangler-dryrun 2>&1 | head -20`
Expected: Wrangler parses the config without a JSON/schema error. It may warn that `.open-next/worker.js` does not exist yet — that is fine at this stage (the build in Task 7 produces it). A *config parse* error is a failure; a *missing entry-point* warning is expected.

- [ ] **Step 3: Commit**

```bash
git add wrangler.jsonc
git commit -m "feat: add wrangler.jsonc for Cloudflare Workers deploy"
```

---

## Task 4: Add npm scripts, gitignore entries, and local dev vars

**Files:**
- Modify: `package.json` (scripts)
- Modify: `.gitignore`
- Create: `.dev.vars` (git-ignored)

- [ ] **Step 1: Add scripts to `package.json`**

Add these three entries to the existing `"scripts"` block (keep `dev`, `build`, `start`, `lint`):

```json
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

- [ ] **Step 2: Append to `.gitignore`**

```gitignore

# Cloudflare / OpenNext
.open-next/
.dev.vars
cloudflare-env.d.ts
.wrangler/
.wrangler-dryrun/
```

- [ ] **Step 3: Create `.dev.vars` for local `preview` runtime secrets**

These feed the workerd runtime used by `opennextjs-cloudflare preview` (they are NOT read from `.env.local` at preview runtime). Fill in the real values:

```
SUPABASE_SERVICE_ROLE_KEY=<real-service-role-key>
ADMIN_PASSWORD=<real-admin-password>
```

- [ ] **Step 4: Verify `.dev.vars` is ignored**

Run: `git check-ignore .dev.vars && git status --porcelain`
Expected: `.dev.vars` printed by `check-ignore`; `.dev.vars` does NOT appear in `git status`.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: add cloudflare preview/deploy scripts and gitignore entries"
```

---

## Task 5: Replace `vercel.json` headers with host-agnostic `next.config.ts` headers

**Files:**
- Modify: `next.config.ts`
- Delete: `vercel.json`

- [ ] **Step 1: Rewrite `next.config.ts` to add the three security headers**

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Delete `vercel.json`**

```bash
git rm vercel.json
```

- [ ] **Step 3: Verify the headers are applied by the Next server**

Run:
```bash
npm run build && npm run start &
sleep 6
curl -sI http://localhost:3000/ | grep -iE "x-content-type-options|x-frame-options|referrer-policy"
kill %1
```
Expected: all three header lines present (`x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: strict-origin-when-cross-origin`).

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "refactor: move security headers from vercel.json into next.config (host-agnostic)"
```

---

## Task 6 (OPTIONAL, low priority): Remove vestigial `x-nonce` dead code

Skip this task if you want the absolute-minimal diff. It is safe because there is **no `middleware.ts`** setting `x-nonce` and **no CSP** consuming the nonce, so `nonce` is always `""`.

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Remove the `headers()` read and the `nonce` usage**

In `app/layout.tsx`, delete the `import { headers } from "next/headers";` line, delete the line `const nonce = (await headers()).get("x-nonce") ?? "";`, and remove `nonce={nonce}` from the `<body>` tag. Keep the `async` on `RootLayout` or drop it (it no longer awaits anything).

Resulting body tag:
```tsx
<body className={`${literata.variable} ${jakarta.variable} ${sarabun.variable}`}>
```

- [ ] **Step 2: Verify build + render still work**

Run:
```bash
npm run build && npm run start &
sleep 6
curl -s http://localhost:3000/ | grep -qi "<body" && echo "RENDER OK"
kill %1
```
Expected: `RENDER OK` and a clean `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "chore: remove vestigial x-nonce dead code from root layout"
```

---

## Task 7: Build with the adapter, check bundle size, and preview locally in workerd

**Files:** none (verification task)

- [ ] **Step 1: Run the OpenNext build**

Run: `npx opennextjs-cloudflare build`
Expected: completes successfully and produces `.open-next/worker.js` and `.open-next/assets/`. Resolve any Node-API or config error here before proceeding.

- [ ] **Step 2: Measure the deployed gzip size to choose the Cloudflare plan**

Run: `npx wrangler deploy --dry-run 2>&1 | grep -iE "total upload|gzip"`
Expected: a line like `Total Upload: <x> KiB / gzip: <y> KiB`.
- If `gzip` ≤ **3 MiB (3072 KiB)** → the Cloudflare **free** plan can host it.
- If `gzip` > 3 MiB (up to 10 MiB) → the **$5/mo paid (Workers Standard)** plan is required.
Record the number in the PR description; it determines the plan chosen in Task 8.

- [ ] **Step 3: Preview the Worker locally in workerd**

Run: `npx opennextjs-cloudflare preview`
Then in a second shell:
```bash
curl -s http://localhost:8787/api/publishers | head -c 200
```
Expected: the preview server starts (default port 8787), the home page loads in a browser at that URL, and `/api/publishers` returns a JSON array of publishers (proves the public API route + Supabase anon client work inside workerd).

- [ ] **Step 4: Verify an admin route reads the runtime secret from `.dev.vars`**

Run (replace `<pw>` with the value in `.dev.vars`):
```bash
curl -s -H "x-admin-password: <pw>" http://localhost:8787/api/admin/data | head -c 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/api/admin/data   # no header
```
Expected: the authorized call returns JSON analytics; the unauthenticated call returns `401` (proves `ADMIN_PASSWORD`/`SUPABASE_SERVICE_ROLE_KEY` resolve from Worker env in workerd).

- [ ] **Step 5: Commit any fixes needed to make the build/preview pass**

```bash
git add -A
git commit -m "fix: adjustments for OpenNext workerd build/preview" --allow-empty
```

---

## Task 8: Provision Cloudflare secrets and do the first manual deploy

**Files:** none (Cloudflare-side configuration + deploy)

- [ ] **Step 1: Authenticate Wrangler**

Run: `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN` in the shell env).
Expected: `Successfully logged in` / token accepted.

- [ ] **Step 2: If Task 7 Step 2 showed gzip > 3 MiB, enable the Workers Standard ($5/mo) plan** for the account in the Cloudflare dashboard (Workers & Pages → Plans). Otherwise stay on Free.

- [ ] **Step 3: Set the two runtime server secrets on the Worker**

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_PASSWORD
```
Enter the real values when prompted. (The `NEXT_PUBLIC_*` vars are inlined at build time and do NOT need to be Worker secrets.)

- [ ] **Step 4: Deploy**

Run: `npm run deploy`
Expected: `opennextjs-cloudflare build` then `wrangler deploy` succeed, printing the deployed URL `https://thai-book-buddy.<account>.workers.dev`. **Record this URL** — Task 9 needs it.

- [ ] **Step 5: Smoke-test the deployed public route**

Run: `curl -s https://thai-book-buddy.<account>.workers.dev/api/publishers | head -c 200`
Expected: JSON array of publishers.

- [ ] **Step 6: Commit (no file changes; note the deploy in the branch)**

```bash
git commit --allow-empty -m "chore: first Cloudflare Workers deploy (thai-book-buddy.<account>.workers.dev)"
```

---

## Task 9: Update external origins — Supabase edge-function CORS, LINE LIFF endpoint, Supabase auth URLs

This is where the app is wired to the new domain. Without it, **LINE login will fail**.

**Files:**
- Modify: `supabase/functions/auth-line/index.ts`

- [ ] **Step 1: Add the new Cloudflare origin(s) to the `auth-line` CORS allowlist**

In `supabase/functions/auth-line/index.ts`, extend `ALLOWED_ORIGINS`:

```ts
const ALLOWED_ORIGINS = [
  "https://bookfair-buddy.vercel.app",
  "https://bookfair-buddy-staging.vercel.app",
  "https://thai-book-buddy.<account>.workers.dev",
  // add the custom production domain too, if/when one is attached
];
```
Keep the Vercel entries until Vercel is decommissioned (Task 12) so both hosts work during cutover.

- [ ] **Step 2: Redeploy the edge function**

Run (from repo root): `supabase functions deploy auth-line`
Expected: deploy succeeds. (Requires the Supabase CLI linked to the project.)

- [ ] **Step 3: Update the LINE LIFF Endpoint URL**

In the LINE Developers Console → your LIFF app → **Endpoint URL**, set it to the new origin (`https://thai-book-buddy.<account>.workers.dev`, or the custom domain). Save.

- [ ] **Step 4: Update Supabase Auth URL configuration**

In Supabase dashboard → Authentication → URL Configuration, add the new origin to **Site URL** / **Redirect URLs** so the `verifyOtp` magic-link flow accepts it.

- [ ] **Step 5: Commit the edge-function change**

```bash
git add supabase/functions/auth-line/index.ts
git commit -m "feat: allow Cloudflare Workers origin in auth-line CORS allowlist"
```

---

## Task 10: End-to-end verification on the deployed Worker

**Files:** none (verification task). Do this inside the LINE app (LIFF requires the LINE webview), or with the dev bypass for the non-LIFF parts.

- [ ] **Step 1: LINE login flow** — Open the LIFF URL from LINE. Expected: LIFF initializes, LINE login succeeds, the `auth-line` call returns a `token_hash` (no CORS error in the console), Supabase `verifyOtp` establishes a session, and onboarding/redirect behaves as before.

- [ ] **Step 2: Core pages** — Visit `/browse`, `/map`, `/my-list`. Expected: publishers load, zone filter and search work, wishlist toggle persists, the SVG booth map zooms/pans, book add/delete + notes work.

- [ ] **Step 3: Preview mode** — Visit `/browse?preview=1` and `/map?preview=1`. Expected: mock data renders without auth.

- [ ] **Step 4: Public API cache** — `curl` `/api/publishers` twice. Expected: valid JSON both times (second served from the in-memory cache within the hour).

- [ ] **Step 5: Admin** — Load `/admin`, enter the password. Expected: dashboard analytics render; a wrong password is rejected; confirm rate-limiting still triggers after repeated failures.

- [ ] **Step 6: Headers** — `curl -sI https://thai-book-buddy.<account>.workers.dev/` — expect the three security headers from Task 5.

- [ ] **Step 7: Record results** in the PR description. If any step fails, fix on this branch and redeploy (`npm run deploy`) before continuing.

---

## Task 11: Switch CI from the Vercel deploy hook to Cloudflare

**Files:**
- Modify: `.github/workflows/deploy-staging.yml`

- [ ] **Step 1: Ensure GitHub Actions secrets exist**

In the repo settings, confirm secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIFF_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`.

- [ ] **Step 2: Replace `.github/workflows/deploy-staging.yml`**

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - develop

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build (OpenNext)
        run: npx opennextjs-cloudflare build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_LIFF_ID: ${{ secrets.NEXT_PUBLIC_LIFF_ID }}
          # Present at build only to satisfy @t3-oss/env-nextjs validation;
          # runtime values come from Worker secrets set in Task 8.
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}

      - name: Deploy (Wrangler)
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 3: Verify the workflow runs**

Push a trivial commit to `develop` (or use the branch's own trigger after merge). Expected: the Action builds and deploys to Cloudflare with no Vercel hook invoked. Confirm the deployed Worker updated.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-staging.yml
git commit -m "ci: deploy to Cloudflare Workers instead of Vercel hook"
```

---

## Task 12 (GUARDED — do only after a safe cutover window): Decommission Vercel

Do NOT run this until the Cloudflare deployment has served real traffic successfully — ideally verified through one book fair, or at minimum a full E2E pass (Task 10) plus a monitored soak. This step is outward-facing and hard to reverse quickly.

- [ ] **Step 1: Confirm production DNS / LIFF endpoint / any custom domain point at Cloudflare**, not Vercel, and have been stable.

- [ ] **Step 2: Remove the Vercel-only Vercel entries from `auth-line` `ALLOWED_ORIGINS`** (leave only Cloudflare/custom origins), then `supabase functions deploy auth-line`.

- [ ] **Step 3: Pause or delete the Vercel project** (dashboard), and remove the `VERCEL_STAGING_DEPLOY_HOOK` GitHub secret.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/auth-line/index.ts
git commit -m "chore: drop Vercel origins from auth-line CORS after Cloudflare cutover"
```

---

## Rollback

At any point before Task 12, Vercel is untouched and remains a working fallback: revert the LINE LIFF Endpoint URL to the Vercel domain and the app is fully restored (the Vercel origins are still in the `auth-line` allowlist until Task 12). To abandon the migration entirely, delete the branch; no `main`/production change happens until the CI workflow (Task 11) is merged.

---

## Self-Review (completed by plan author)

- **Spec coverage:** Off-Vercel deploy (Tasks 1–8, 11), scale-to-zero host (Cloudflare Workers, Task 3/8), no framework rewrite (adapter only), Vercel-coupling removed (`vercel.json` → Task 5; CI hook → Task 11), Supabase/LIFF re-wiring incl. the hardcoded CORS allowlist (Task 9), plan-vs-cost decision point (Task 7 Step 2), safe reversible cutover (Task 12 + Rollback). Covered.
- **Placeholder scan:** `<account>` and secret values are intentional fill-ins (environment-specific), called out explicitly, not vague TODOs. No "add error handling"/"write tests"-style placeholders.
- **Type/name consistency:** `wrangler.jsonc` `main` = `.open-next/worker.js` and `assets.directory` = `.open-next/assets` match the OpenNext build output referenced in Task 7. Script names (`preview`/`deploy`/`cf-typegen`) are consistent across Tasks 4, 7, 8, 11. Env var names match `utils/env.ts` exactly.
- **Adaptation note:** No unit-test framework exists in this repo (`CLAUDE.md`), so TDD steps are expressed as concrete build/curl/preview **verification** steps with expected output rather than assertion tests. This is deliberate for an infra migration.

---

## Follow-up (separate plan, not in scope here)

**vinext trial on staging.** `vinext` (Cloudflare's Vite-based Next.js reimplementation) is the longer-term "no-lock-in, faster build, deploy-anywhere" option and fits this all-client app well, but as of 2026-07-11 it is `v1.0.0-beta.1` (one day old) and Cloudflare labels it experimental. Trialling it is worthwhile but belongs in its own plan, gated on: (a) a stable 1.0 release, (b) resolving the **React Compiler** gap (this app sets `reactCompiler: true`; vinext does not support it — verify a Vite-plugin workaround or accept dropping it), and (c) a load test at fair-scale before any production use. Do not couple it to this migration.
