-- ============================================================
-- Update admin_get_publisher_stats to accept event_id
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_publisher_stats(p_event_id uuid)
RETURNS TABLE (
  id uuid,
  name_th text,
  name_en text,
  saves bigint,
  books_added bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name_th,
    p.name_en,
    COUNT(DISTINCT us.user_id) AS saves,
    COUNT(DISTINCT ub.id) AS books_added
  FROM publishers p
  LEFT JOIN user_selections us ON us.publisher_id = p.id AND us.event_id = p_event_id
  LEFT JOIN user_books ub ON ub.publisher_id = p.id AND ub.event_id = p_event_id
  WHERE p.event_id = p_event_id
  GROUP BY p.id, p.name_th, p.name_en
  ORDER BY saves DESC;
$$;

-- ============================================================
-- Update admin_get_dau to accept event_id
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_dau(p_event_id uuid)
RETURNS TABLE (
  date text,
  count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    TO_CHAR(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS date,
    COUNT(DISTINCT user_id) AS count
  FROM sessions
  WHERE event_id = p_event_id
  GROUP BY date
  ORDER BY date;
$$;

-- ============================================================
-- Update admin_get_global_demographics to accept event_id
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_global_demographics(p_event_id uuid)
RETURNS TABLE (
  dimension text,
  value text,
  count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH event_users AS (
    SELECT DISTINCT us.user_id
    FROM user_selections us
    WHERE us.event_id = p_event_id
  )
  SELECT 'age' AS dimension, p.age AS value, COUNT(*) AS count
  FROM profiles p
  JOIN event_users eu ON eu.user_id = p.id
  WHERE p.age IS NOT NULL AND p.gender IS NOT NULL
  GROUP BY p.age
  UNION ALL
  SELECT 'gender' AS dimension, p.gender AS value, COUNT(*) AS count
  FROM profiles p
  JOIN event_users eu ON eu.user_id = p.id
  WHERE p.age IS NOT NULL AND p.gender IS NOT NULL
  GROUP BY p.gender;
$$;

-- ============================================================
-- Update admin_get_top_books to accept event_id
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_top_books(p_event_id uuid, n integer DEFAULT 10)
RETURNS TABLE (
  title text,
  count bigint,
  publisher_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH book_counts AS (
    SELECT
      LOWER(TRIM(ub.title)) AS normalized_title,
      MIN(ub.title) AS title,
      COUNT(*) AS count,
      MODE() WITHIN GROUP (ORDER BY p.name_th) AS publisher_name
    FROM user_books ub
    JOIN publishers p ON p.id = ub.publisher_id
    WHERE ub.event_id = p_event_id
    GROUP BY normalized_title
    ORDER BY count DESC
    LIMIT n
  )
  SELECT title, count, publisher_name FROM book_counts;
$$;

-- ============================================================
-- Update get_my_book_counts to accept event_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_book_counts(p_event_id uuid)
RETURNS TABLE (
  publisher_id uuid,
  count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT publisher_id, COUNT(*) AS count
  FROM user_books
  WHERE user_id = auth.uid()
    AND event_id = p_event_id
  GROUP BY publisher_id;
$$;

-- ============================================================
-- Update get_share_stats to accept event_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_share_stats(p_event_id uuid)
RETURNS TABLE (
  purchased_count bigint,
  percentile integer,
  total_spent bigint,
  booth_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_stats AS (
    SELECT
      ub.user_id,
      COUNT(*) FILTER (WHERE ub.is_purchased = true) AS purchased_count,
      COALESCE(SUM(ub.price) FILTER (WHERE ub.is_purchased = true), 0) AS total_spent
    FROM user_books ub
    WHERE ub.event_id = p_event_id
    GROUP BY ub.user_id
  ),
  ranked AS (
    SELECT
      user_id,
      purchased_count,
      total_spent,
      CASE
        WHEN COUNT(*) OVER () = 1 THEN 0
        ELSE (percent_rank() OVER (ORDER BY purchased_count ASC) * 100)::integer
      END AS percentile
    FROM user_stats
  )
  SELECT
    r.purchased_count,
    r.percentile,
    r.total_spent,
    (SELECT COUNT(DISTINCT b.id)
     FROM user_selections us
     JOIN booths b ON b.publisher_id = us.publisher_id
     WHERE us.user_id = auth.uid()
       AND us.event_id = p_event_id) AS booth_count
  FROM ranked r
  WHERE r.user_id = auth.uid();
$$;

-- ============================================================
-- Revoke direct access, allow only via service_role for admin RPCs
-- ============================================================
REVOKE EXECUTE ON FUNCTION admin_get_publisher_stats(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_get_dau(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_get_global_demographics(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_get_top_books(uuid, integer) FROM anon, authenticated;
