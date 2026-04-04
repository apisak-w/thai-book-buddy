-- Add composite partial index on profiles for demographic queries.
-- Used by admin_get_global_demographics() and admin_get_publisher_demographics()
-- which filter on age IS NOT NULL AND gender IS NOT NULL and GROUP BY age, gender.
CREATE INDEX IF NOT EXISTS idx_profiles_age_gender
  ON profiles(age, gender)
  WHERE age IS NOT NULL AND gender IS NOT NULL;
