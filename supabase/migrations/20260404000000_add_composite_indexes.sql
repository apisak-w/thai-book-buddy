-- Composite indexes for queries that filter by both user_id and publisher_id.
-- Complements existing single-column indexes from 20260311000000_add_performance_indexes.sql.

-- Admin stats RPCs group by publisher_id then join on user_id
CREATE INDEX IF NOT EXISTS idx_user_selections_publisher_user
  ON user_selections(publisher_id, user_id);

-- User queries (my-list, browse delete) filter by user_id then publisher_id
CREATE INDEX IF NOT EXISTS idx_user_books_user_publisher
  ON user_books(user_id, publisher_id);
