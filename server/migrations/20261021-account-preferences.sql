-- Development migration. Publish promotes the development schema; no startup DDL.
ALTER TABLE open_door_account_state
  ADD COLUMN IF NOT EXISTS preferences jsonb
  CHECK (preferences IS NULL OR jsonb_typeof(preferences) = 'object');
