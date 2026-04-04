-- Returns book counts grouped by publisher_id for the current user.
-- Replaces the unbounded SELECT on user_books in the browse page.
create or replace function get_my_book_counts()
returns table(publisher_id uuid, count bigint)
language sql
security invoker
stable
as $$
  select publisher_id, count(*) as count
  from user_books
  where user_id = auth.uid()
  group by publisher_id;
$$;
