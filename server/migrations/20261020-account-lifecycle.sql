-- Apply before starting the updated server; safe to apply more than once.
CREATE TABLE IF NOT EXISTS open_door_account_state (
  clerk_user_id text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closing', 'closed')),
  checked_at timestamptz
);
