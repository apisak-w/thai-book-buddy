-- ============================================================
-- 1. Create events table
-- ============================================================
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th text NOT NULL,
  name_en text NOT NULL,
  slug text UNIQUE NOT NULL,
  description_th text,
  description_en text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location_th text,
  location_en text,
  location_url text,
  map_image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz DEFAULT now()
);

-- Index for directory queries
CREATE INDEX idx_events_status ON events (status);

-- RLS: anyone can read events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are publicly readable"
  ON events FOR SELECT
  USING (true);

-- ============================================================
-- 2. Seed first event (Thai Book Fair 2569)
-- ============================================================
INSERT INTO events (id, name_th, name_en, slug, start_date, end_date, location_th, location_en, location_url, map_image_url, status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'งานสัปดาห์หนังสือแห่งชาติ ครั้งที่ 54',
  'National Book Week 54th',
  'national-book-week-54',
  '2026-03-26',
  '2026-04-06',
  'ศูนย์การประชุมแห่งชาติสิริกิติ์',
  'Queen Sirikit National Convention Center',
  'https://maps.app.goo.gl/QSNkC',
  '/booth-map-2569.jpg',
  'active'
);

-- ============================================================
-- 3. Add event_id to publishers
-- ============================================================
ALTER TABLE publishers ADD COLUMN event_id uuid REFERENCES events(id);
UPDATE publishers SET event_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE publishers ALTER COLUMN event_id SET NOT NULL;
CREATE INDEX idx_publishers_event_id ON publishers (event_id);

-- ============================================================
-- 4. Add event_id to booths
-- ============================================================
ALTER TABLE booths ADD COLUMN event_id uuid REFERENCES events(id);
UPDATE booths SET event_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE booths ALTER COLUMN event_id SET NOT NULL;
CREATE INDEX idx_booths_event_id ON booths (event_id);

-- ============================================================
-- 5. Add event_id to user_selections
-- ============================================================
ALTER TABLE user_selections ADD COLUMN event_id uuid REFERENCES events(id);
UPDATE user_selections SET event_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE user_selections ALTER COLUMN event_id SET NOT NULL;
CREATE INDEX idx_user_selections_event_id ON user_selections (event_id);
CREATE INDEX idx_user_selections_user_event ON user_selections (user_id, event_id);

-- Update unique constraint: user can select same publisher in different events
ALTER TABLE user_selections DROP CONSTRAINT user_selections_user_id_publisher_id_key;
ALTER TABLE user_selections ADD CONSTRAINT user_selections_user_event_publisher_key UNIQUE (user_id, event_id, publisher_id);

-- ============================================================
-- 6. Add event_id to user_books
-- ============================================================
ALTER TABLE user_books ADD COLUMN event_id uuid REFERENCES events(id);
UPDATE user_books SET event_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE user_books ALTER COLUMN event_id SET NOT NULL;
CREATE INDEX idx_user_books_event_id ON user_books (event_id);

-- ============================================================
-- 7. Add event_id to sessions
-- ============================================================
ALTER TABLE sessions ADD COLUMN event_id uuid REFERENCES events(id);
UPDATE sessions SET event_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE sessions ALTER COLUMN event_id SET NOT NULL;
CREATE INDEX idx_sessions_event_id ON sessions (event_id);

-- ============================================================
-- 8. Create user_events table
-- ============================================================
CREATE TABLE user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  event_id uuid NOT NULL REFERENCES events(id),
  is_active boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX idx_user_events_user_active ON user_events (user_id, is_active);

-- RLS: users manage their own rows
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own user_events"
  ON user_events FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_events"
  ON user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user_events"
  ON user_events FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 9. Backfill user_events from existing user_selections
-- ============================================================
INSERT INTO user_events (user_id, event_id, is_active)
SELECT DISTINCT user_id, 'a0000000-0000-0000-0000-000000000001'::uuid, true
FROM user_selections;
