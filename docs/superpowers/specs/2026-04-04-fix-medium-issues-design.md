# Fix Medium-Priority Issues (#13, #14, #15, #18, #19) Design Spec

**Goal:** Fix 5 medium-priority GitHub issues — browse page error handling, togglePurchased rollback, undo-delete index bug, missing composite indexes, and session table retention.

**Deferred:** #17 (edge function rate limiter) — deferred due to infrastructure complexity; in-memory limiter provides baseline protection.

---

## Fix 1: Browse page query error handling (#13)

**File:** `app/browse/page.tsx:107-130`

**Problem:** The `loadUserData` function destructures `data` from Supabase queries without checking `error`. If `user_selections` or `get_my_book_counts` fails, the user silently sees empty selections with no indication of failure.

**Fix:**
- Destructure `error` alongside `data` for both the `user_selections` query and `get_my_book_counts` RPC
- If any error is present, throw to hit the existing catch block
- In the catch block, set a new `userLoadError` boolean state to `true`
- Add a `userRetryKey` state (number) — incrementing it re-triggers the `useEffect`
- Render a retry banner when `userLoadError` is true: "ไม่สามารถโหลดข้อมูลได้" with a retry button that increments `userRetryKey` and clears the error
- The publisher list still loads independently — only selections/counts are affected

**Changes:**
```
app/browse/page.tsx
  - Add state: userLoadError (boolean), userRetryKey (number)
  - Destructure { data: sels, error: selsError } and { data: counts, error: countsError }
  - Throw on selsError or countsError
  - In catch block: setUserLoadError(true)
  - Reset userLoadError to false at start of loadUserData
  - Add userRetryKey to useEffect dependency array
  - Render error banner with retry button above publisher list when userLoadError is true
```

---

## Fix 2: togglePurchased rollback on failure (#14)

**File:** `app/my-list/page.tsx:212-222`

**Problem:** `togglePurchased` optimistically updates UI and shows a success toast before the DB call resolves. If the update fails, there's no rollback and no error indication.

**Fix:**
- Keep the optimistic UI update (responsive feel)
- Move the success toast to after DB confirmation
- Wrap the Supabase `update()` in try/catch
- Check `.error` on the response (Supabase client doesn't throw on DB errors)
- On failure: revert `books` state to previous `is_purchased` value, show error toast for 3s

**Changes:**
```
app/my-list/page.tsx (togglePurchased function)
  - Keep setBooks optimistic update at top
  - Remove immediate success toast
  - Add try/catch around supabase.from("user_books").update(...)
  - Check for .error on response, throw if present
  - On success: show success toast
  - On failure: revert the book's is_purchased, show error toast
```

---

## Fix 3: Undo-delete stale index bug (#15)

**File:** `app/my-list/page.tsx:168-210`

**Problem:** `removePublisher` and `deleteBook` capture the current array index at deletion time and use `splice(idx, 0, removed)` to undo. With rapid deletions, captured indexes become stale and items are restored at wrong positions.

**Fix:** Instead of capturing an index, capture the removed item and on undo, append it back then re-sort by the stable order.

For **publishers**: The publishers are loaded sorted by `name_th` (Thai locale). On undo, append the removed publisher and re-sort with `.sort((a, b) => a.name_th.localeCompare(b.name_th, "th"))`.

For **books**: Books are ordered by `created_at` from the DB. On undo, append the removed book back. Since books are grouped by publisher in the UI (not by array position), append order doesn't affect display — books are rendered per-publisher via `.filter(b => b.publisher_id === p.id)`.

**Changes:**
```
app/my-list/page.tsx (removePublisher function)
  - Remove: const idx = publishers.findIndex(...)
  - Undo callback: setPublishers(prev => [...prev, removed].sort((a, b) => a.name_th.localeCompare(b.name_th, "th")))

app/my-list/page.tsx (deleteBook function)
  - Remove: const idx = books.findIndex(...)
  - Undo callback: setBooks(prev => [...prev, removed])
```

---

## Fix 4: Missing composite indexes (#18)

**New file:** `supabase/migrations/20260404000000_add_composite_indexes.sql`

**Problem:** `user_selections` and `user_books` have single-column indexes but no composite indexes. Queries filtering by both `user_id` and `publisher_id` (admin stats, browse page delete, per-user lookups) can't use a covering index.

**Fix:** Add two composite indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_user_selections_publisher_user
  ON user_selections(publisher_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_books_user_publisher
  ON user_books(user_id, publisher_id);
```

The column order matches the most common query patterns:
- `user_selections(publisher_id, user_id)` — admin stats group by publisher_id
- `user_books(user_id, publisher_id)` — user queries filter by user_id first, then publisher_id

---

## Fix 5: Session retention + DAU summary table (#19)

**New file:** `supabase/migrations/20260404000001_session_retention_and_dau_summary.sql`

**Problem:** The `sessions` table retains 60 days of raw rows. `admin_get_dau()` scans the entire table for distinct user counts per day. At 10K DAU this means 600K+ rows scanned. The nightly cleanup deletes large batches causing IO spikes.

**Fix:** Four changes in one migration:

1. **Create `daily_active_users` table:**
   ```sql
   CREATE TABLE IF NOT EXISTS daily_active_users (
     date DATE PRIMARY KEY,
     count INTEGER NOT NULL
   );
   ```

2. **Nightly aggregation cron job** (runs at 1:55am UTC, before the cleanup at 2am):
   ```sql
   INSERT INTO daily_active_users (date, count)
   SELECT
     (created_at AT TIME ZONE 'Asia/Bangkok')::date,
     COUNT(DISTINCT user_id)
   FROM sessions
   WHERE created_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day'
     AND created_at < (now() AT TIME ZONE 'Asia/Bangkok')::date
   ON CONFLICT (date) DO UPDATE SET count = EXCLUDED.count;
   ```

3. **Shorten raw retention to 7 days:** Update the existing cleanup cron from `60 days` to `7 days`.

4. **Update `admin_get_dau()` RPC:** Read from `daily_active_users` instead of scanning raw `sessions`. Also union with today's live count from `sessions` for real-time accuracy.

   ```sql
   CREATE OR REPLACE FUNCTION admin_get_dau()
   RETURNS TABLE(date TEXT, count BIGINT)
   LANGUAGE sql SECURITY INVOKER AS $$
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

5. **Backfill existing data:** Aggregate all existing sessions into `daily_active_users` so historical data isn't lost when retention shortens.

**RLS:** `daily_active_users` needs no RLS — it's only accessed via the `admin_get_dau()` RPC which is called from the admin API route (server-side, service role key).
