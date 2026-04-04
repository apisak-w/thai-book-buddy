# Fix Medium-Priority Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 medium-priority GitHub issues — browse page error handling (#13), togglePurchased rollback (#14), undo-delete index bug (#15), missing composite indexes (#18), and session table retention (#19).

**Architecture:** Tasks 1-3 are client-side fixes in two React pages. Tasks 4-5 are SQL migrations. No new dependencies or abstractions — each fix is minimal and targeted.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Supabase (JS client + SQL migrations), pg_cron

---

### Task 1: Add error handling to browse page user data queries (Issue #13)

**Files:**
- Modify: `app/browse/page.tsx:17-130` (state declarations + `loadUserData` useEffect)

- [ ] **Step 1: Add error state and retry key, destructure errors in loadUserData**

In `app/browse/page.tsx`, add two new state variables after the existing `userLoaded` state (line 29), and modify the `loadUserData` useEffect (lines 105-130) to check for errors.

Find the state declarations block and add after `const [userLoaded, setUserLoaded] = useState(false);` (this line doesn't exist literally — `userLoaded` is set inside the effect. Add the new states after line 31, the `confirmPublisherId` state):

Replace lines 29-31:
```tsx
  const [userLoaded, setUserLoaded] = useState(false);
  const [bookCounts, setBookCounts] = useState<Map<string, number>>(new Map());
  const [confirmPublisherId, setConfirmPublisherId] = useState<string | null>(null);
```

With:
```tsx
  const [userLoaded, setUserLoaded] = useState(false);
  const [userLoadError, setUserLoadError] = useState(false);
  const [userRetryKey, setUserRetryKey] = useState(0);
  const [bookCounts, setBookCounts] = useState<Map<string, number>>(new Map());
  const [confirmPublisherId, setConfirmPublisherId] = useState<string | null>(null);
```

Then replace the entire `loadUserData` useEffect (lines 105-130):

```tsx
  useEffect(() => {
    if (isPreview || !isLoggedIn) return;
    async function loadUserData() {
      setUserLoadError(false);
      try {
        const supabase = getSupabase();
        const [{ data: { session } }, { data: sels, error: selsError }, { data: counts, error: countsError }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from("user_selections").select("publisher_id"),
          supabase.rpc("get_my_book_counts"),
        ]);
        if (selsError) throw selsError;
        if (countsError) throw countsError;
        if (session?.user) setUserId(session.user.id);
        if (sels) setSelectedIds(new Set(sels.map((s: { publisher_id: string }) => s.publisher_id)));
        if (counts) {
          const map = new Map<string, number>();
          for (const c of counts as { publisher_id: string; count: number }[]) {
            map.set(c.publisher_id, Number(c.count));
          }
          setBookCounts(map);
        }
      } catch {
        setUserLoadError(true);
      }
      setUserLoaded(true);
    }
    loadUserData();
  }, [isLoggedIn, userRetryKey]);
```

Key changes from original:
- Destructure `error: selsError` and `error: countsError` alongside data
- Throw on either error to trigger catch block
- Catch block sets `setUserLoadError(true)` instead of silently ignoring
- `setUserLoadError(false)` at top to clear error on retry
- Added `userRetryKey` to dependency array

- [ ] **Step 2: Add retry banner in the JSX**

In the same file, find the `{/* Count row */}` section (around line 243). Add the error banner just before it, inside the sticky search + filter div:

Find this block (the count row div):
```tsx
          {/* Count row */}
          <div className="flex items-center justify-between px-[16px] pb-[12px]">
```

Insert this immediately before it:
```tsx
          {/* User data error banner */}
          {userLoadError && (
            <div className="mx-[16px] mb-[8px] flex items-center justify-between bg-[#fff0e0] border border-[#e2c9a6] rounded-[12px] px-[16px] py-[10px]">
              <p className="font-[family-name:var(--font-sarabun)] text-[14px] text-[#973c00]">
                ไม่สามารถโหลดข้อมูลได้
              </p>
              <button
                onClick={() => setUserRetryKey((k) => k + 1)}
                className="font-[family-name:var(--font-sarabun)] font-medium text-[14px] text-[#c4855a]"
              >
                ลองใหม่
              </button>
            </div>
          )}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/browse/page.tsx
git commit -m "fix: add error handling and retry to browse page user data queries

Destructure and check Supabase error fields. Show retry banner on failure
instead of silently showing empty selections.

Closes #13"
```

---

### Task 2: Add error handling and rollback to togglePurchased (Issue #14)

**Files:**
- Modify: `app/my-list/page.tsx:212-222`

- [ ] **Step 1: Add try/catch with rollback to togglePurchased**

In `app/my-list/page.tsx`, replace the `togglePurchased` function (lines 212-222):

```tsx
  async function togglePurchased(book: Book) {
    const updated = !book.is_purchased;
    setBooks((prev) => prev.map((b) => b.id === book.id ? { ...b, is_purchased: updated } : b));
    if (updated) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: "ซื้อหนังสือแล้ว 🎉", onUndo: null });
      toastTimer.current = setTimeout(() => setToast(null), 2500);
    }
    const supabase = getSupabase();
    await supabase.from("user_books").update({ is_purchased: updated }).eq("id", book.id);
  }
```

With:

```tsx
  async function togglePurchased(book: Book) {
    const updated = !book.is_purchased;
    setBooks((prev) => prev.map((b) => b.id === book.id ? { ...b, is_purchased: updated } : b));
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("user_books").update({ is_purchased: updated }).eq("id", book.id);
      if (error) throw error;
      if (updated) {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message: "ซื้อหนังสือแล้ว 🎉", onUndo: null });
        toastTimer.current = setTimeout(() => setToast(null), 2500);
      }
    } catch {
      setBooks((prev) => prev.map((b) => b.id === book.id ? { ...b, is_purchased: !updated } : b));
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: "เกิดข้อผิดพลาด กรุณาลองใหม่", onUndo: null });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
  }
```

Key changes:
- Optimistic update stays at top for responsive feel
- Success toast moves inside try block, after DB confirms
- On failure: revert `is_purchased` back and show error toast for 3s
- Check `.error` on Supabase response (it doesn't throw on DB errors)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/my-list/page.tsx
git commit -m "fix: add error handling and rollback to togglePurchased

Check Supabase response error and revert optimistic update on failure.
Move success toast to after DB confirmation.

Closes #14"
```

---

### Task 3: Fix undo-delete stale index bug (Issue #15)

**Files:**
- Modify: `app/my-list/page.tsx:168-210`

- [ ] **Step 1: Fix removePublisher undo to use sort instead of stale index**

In `app/my-list/page.tsx`, replace the `removePublisher` function (lines 168-193):

```tsx
  function removePublisher(publisherId: string) {
    if (!userId) return;
    const idx = publishers.findIndex((p) => p.id === publisherId);
    const removed = publishers[idx];
    const removedBooks = books.filter((b) => b.publisher_id === publisherId);
    const removedNote = notesByPublisher.get(publisherId);
    setPublishers((prev) => prev.filter((p) => p.id !== publisherId));
    setBooks((prev) => prev.filter((b) => b.publisher_id !== publisherId));
    setNotesByPublisher((prev) => { const next = new Map(prev); next.delete(publisherId); return next; });
    showToast(
      "ลบรายการสำเร็จ",
      () => {
        cancelPending();
        setPublishers((prev) => { const next = [...prev]; next.splice(idx, 0, removed); return next; });
        setBooks((prev) => [...prev, ...removedBooks]);
        if (removedNote) setNotesByPublisher((prev) => { const next = new Map(prev); next.set(publisherId, removedNote); return next; });
      },
      async () => {
        const supabase = getSupabase();
        await Promise.all([
          supabase.from("user_selections").delete().eq("user_id", userId).eq("publisher_id", publisherId),
          supabase.from("user_books").delete().eq("user_id", userId).eq("publisher_id", publisherId),
        ]);
      }
    );
  }
```

With:

```tsx
  function removePublisher(publisherId: string) {
    if (!userId) return;
    const removed = publishers.find((p) => p.id === publisherId);
    if (!removed) return;
    const removedBooks = books.filter((b) => b.publisher_id === publisherId);
    const removedNote = notesByPublisher.get(publisherId);
    setPublishers((prev) => prev.filter((p) => p.id !== publisherId));
    setBooks((prev) => prev.filter((b) => b.publisher_id !== publisherId));
    setNotesByPublisher((prev) => { const next = new Map(prev); next.delete(publisherId); return next; });
    showToast(
      "ลบรายการสำเร็จ",
      () => {
        cancelPending();
        setPublishers((prev) => [...prev, removed].sort((a, b) => a.name_th.localeCompare(b.name_th, "th")));
        setBooks((prev) => [...prev, ...removedBooks]);
        if (removedNote) setNotesByPublisher((prev) => { const next = new Map(prev); next.set(publisherId, removedNote); return next; });
      },
      async () => {
        const supabase = getSupabase();
        await Promise.all([
          supabase.from("user_selections").delete().eq("user_id", userId).eq("publisher_id", publisherId),
          supabase.from("user_books").delete().eq("user_id", userId).eq("publisher_id", publisherId),
        ]);
      }
    );
  }
```

Key changes:
- Use `find` instead of `findIndex` — we only need the item, not its position
- Add early return if publisher not found (defensive)
- Undo callback: append `removed` then sort by `name_th` Thai locale — always correct regardless of how many items were deleted between capture and undo

- [ ] **Step 2: Fix deleteBook undo to use append instead of stale index**

In the same file, replace the `deleteBook` function (lines 195-210):

```tsx
  function deleteBook(bookId: string) {
    const idx = books.findIndex((b) => b.id === bookId);
    const removed = books[idx];
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    showToast(
      "ลบหนังสือสำเร็จ",
      () => {
        cancelPending();
        setBooks((prev) => { const next = [...prev]; next.splice(idx, 0, removed); return next; });
      },
      async () => {
        const supabase = getSupabase();
        await supabase.from("user_books").delete().eq("id", bookId);
      }
    );
  }
```

With:

```tsx
  function deleteBook(bookId: string) {
    const removed = books.find((b) => b.id === bookId);
    if (!removed) return;
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    showToast(
      "ลบหนังสือสำเร็จ",
      () => {
        cancelPending();
        setBooks((prev) => [...prev, removed]);
      },
      async () => {
        const supabase = getSupabase();
        await supabase.from("user_books").delete().eq("id", bookId);
      }
    );
  }
```

Key changes:
- Use `find` instead of `findIndex`
- Add early return if book not found
- Undo callback: simple append. Books are rendered per-publisher via `.filter(b => b.publisher_id === p.id)` in the UI, so array position doesn't matter

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/my-list/page.tsx
git commit -m "fix: use sort-based undo instead of stale array index

Replace splice(idx) with append+sort for publishers and append for books.
Fixes incorrect undo position when multiple items are deleted rapidly.

Closes #15"
```

---

### Task 4: Add composite indexes on join columns (Issue #18)

**Files:**
- Create: `supabase/migrations/20260404000000_add_composite_indexes.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260404000000_add_composite_indexes.sql`:

```sql
-- Composite indexes for queries that filter by both user_id and publisher_id.
-- Complements existing single-column indexes from 20260311000000_add_performance_indexes.sql.

-- Admin stats RPCs group by publisher_id then join on user_id
CREATE INDEX IF NOT EXISTS idx_user_selections_publisher_user
  ON user_selections(publisher_id, user_id);

-- User queries (my-list, browse delete) filter by user_id then publisher_id
CREATE INDEX IF NOT EXISTS idx_user_books_user_publisher
  ON user_books(user_id, publisher_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260404000000_add_composite_indexes.sql
git commit -m "perf: add composite indexes on user_selections and user_books

Adds (publisher_id, user_id) on user_selections for admin stats queries
and (user_id, publisher_id) on user_books for per-user filtered queries.

Closes #18"
```

---

### Task 5: Add DAU summary table and shorten session retention (Issue #19)

**Files:**
- Create: `supabase/migrations/20260404000001_session_retention_and_dau_summary.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260404000001_session_retention_and_dau_summary.sql`:

```sql
-- 1. Create daily_active_users summary table
CREATE TABLE IF NOT EXISTS daily_active_users (
  date DATE PRIMARY KEY,
  count INTEGER NOT NULL
);

-- No RLS needed — only accessed via admin_get_dau() RPC through service role

-- 2. Backfill from existing sessions data (before we shorten retention)
INSERT INTO daily_active_users (date, count)
SELECT
  (created_at AT TIME ZONE 'Asia/Bangkok')::date AS date,
  COUNT(DISTINCT user_id)::integer AS count
FROM sessions
GROUP BY 1
ON CONFLICT (date) DO UPDATE SET count = EXCLUDED.count;

-- 3. Nightly aggregation cron job: aggregate yesterday's sessions at 1:55am UTC
--    (runs before the 2:00am cleanup job)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'aggregate-dau';

SELECT cron.schedule(
  'aggregate-dau',
  '55 1 * * *',
  $$
    INSERT INTO public.daily_active_users (date, count)
    SELECT
      (created_at AT TIME ZONE 'Asia/Bangkok')::date,
      COUNT(DISTINCT user_id)::integer
    FROM public.sessions
    WHERE created_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day'
      AND created_at < (now() AT TIME ZONE 'Asia/Bangkok')::date
    GROUP BY 1
    ON CONFLICT (date) DO UPDATE SET count = EXCLUDED.count;
  $$
);

-- 4. Shorten raw session retention from 60 days to 7 days
--    (replaces the existing cleanup-old-sessions job from 20260324000002)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-old-sessions';

SELECT cron.schedule(
  'cleanup-old-sessions',
  '0 2 * * *',
  'DELETE FROM public.sessions WHERE created_at < now() - INTERVAL ''7 days'''
);

-- 5. Replace admin_get_dau() to read from summary table + today's live count
CREATE OR REPLACE FUNCTION admin_get_dau()
RETURNS TABLE(date text, count bigint)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT * FROM (
    SELECT date::text, count::bigint FROM daily_active_users
    UNION ALL
    SELECT
      to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD'),
      COUNT(DISTINCT user_id)
    FROM sessions
    WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date
    GROUP BY 1
  ) combined
  ORDER BY 1;
$$;
```

Key design decisions:
- Backfill runs first, before retention change, so no historical data is lost
- Aggregation cron runs at 1:55am UTC, 5 minutes before cleanup at 2:00am
- `ON CONFLICT DO UPDATE` makes both backfill and nightly job idempotent
- `admin_get_dau()` unions summary table with today's live sessions for real-time accuracy
- The UNION ALL may produce a duplicate for today if the aggregation cron already ran — the `ON CONFLICT` in the cron handles this, and the RPC will show the live count from today's sessions. Since the summary table only has completed days (aggregated after midnight), and the UNION ALL adds today's live count, there's no overlap.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260404000001_session_retention_and_dau_summary.sql
git commit -m "perf: add DAU summary table and shorten session retention to 7 days

Creates daily_active_users table with nightly cron aggregation.
Backfills historical data from sessions. Updates admin_get_dau() to
read from summary table + today's live count.

Closes #19"
```
