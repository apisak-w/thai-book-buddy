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
      WHERE date < (now() AT TIME ZONE 'Asia/Bangkok')::date
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
