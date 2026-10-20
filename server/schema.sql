-- Canonical development schema for account-owned saved doors.
-- Replit's Publish flow promotes this development schema to production.
CREATE TABLE open_door_saved_doors (
  clerk_user_id text NOT NULL,
  door_id text NOT NULL CHECK (length(door_id) BETWEEN 1 AND 256),
  door_data jsonb NOT NULL CHECK (jsonb_typeof(door_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clerk_user_id, door_id)
);

CREATE INDEX open_door_saved_doors_by_owner
  ON open_door_saved_doors (clerk_user_id, updated_at DESC);

-- Idempotent, account-scoped milestones earned through explicit door opens.
CREATE TABLE open_door_progress_events (
  clerk_user_id text NOT NULL,
  door_id text NOT NULL CHECK (length(door_id) BETWEEN 1 AND 256),
  tier text NOT NULL CHECK (tier IN ('Familiar', 'Adjacent', 'Unexpected')),
  category text NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clerk_user_id, door_id)
);

CREATE INDEX open_door_progress_by_owner
  ON open_door_progress_events (clerk_user_id, tier, category);
