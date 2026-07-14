BEGIN;

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY,
  auth0_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  admitted_at timestamptz,
  disabled_at timestamptz
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS admitted_at timestamptz;

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text,
  token_salt bytea NOT NULL,
  token_hash bytea NOT NULL,
  token_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS devices_active_name_per_account
  ON devices(account_id, lower(name))
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS devices_account_id_idx ON devices(account_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  outcome text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_account_created_idx
  ON audit_events(account_id, created_at DESC);

COMMIT;
