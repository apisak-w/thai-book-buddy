-- Returns share card stats for the current user:
-- purchased_count, percentile (0-100), total_spent, booth_count
create or replace function get_share_stats()
returns table(
  purchased_count bigint,
  percentile integer,
  total_spent bigint,
  booth_count bigint
)
language sql
security invoker
stable
as $$
  with user_counts as (
    select
      ub.user_id,
      count(*) as cnt
    from user_books ub
    where ub.is_purchased = true
    group by ub.user_id
  ),
  ranked as (
    select
      user_id,
      cnt,
      percent_rank() over (order by cnt) as pct
    from user_counts
  ),
  my_rank as (
    select
      coalesce(cnt, 0) as purchased_count,
      coalesce((pct * 100)::integer, 0) as percentile
    from ranked
    where user_id = auth.uid()
  ),
  my_spent as (
    select coalesce(sum(price), 0) as total_spent
    from user_books
    where user_id = auth.uid() and is_purchased = true
  ),
  my_booths as (
    select count(*) as booth_count
    from user_selections
    where user_id = auth.uid()
  )
  select
    coalesce(r.purchased_count, 0),
    coalesce(r.percentile, 0),
    s.total_spent,
    b.booth_count
  from my_spent s
  cross join my_booths b
  left join my_rank r on true;
$$;
