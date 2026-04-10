-- Ф5.2: Push token storage for ActivityKit Live Activity remote updates
--
-- Run in Supabase SQL Editor:
--   Dashboard → your project → SQL Editor → paste and Run

-- 1. Create push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT        NOT NULL UNIQUE,
  platform    TEXT        NOT NULL DEFAULT 'ios_live_activity',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Allow anon to upsert tokens (iOS app writes on Live Activity start)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens' AND policyname = 'allow_anon_upsert'
  ) THEN
    CREATE POLICY allow_anon_upsert ON push_tokens
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. RPC to upsert a push token atomically
CREATE OR REPLACE FUNCTION upsert_push_token(
  p_token    TEXT,
  p_platform TEXT DEFAULT 'ios_live_activity'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO push_tokens (token, platform)
  VALUES (p_token, p_platform)
  ON CONFLICT (token)
  DO UPDATE SET updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_push_token(TEXT, TEXT) TO anon;
