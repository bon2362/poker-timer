-- iOS Live Activity support migration
-- Run this in the Supabase SQL Editor:
-- Dashboard → your project → SQL Editor → paste and Run

-- 1. Add iOS Live Activity columns to timer_state
ALTER TABLE timer_state
  ADD COLUMN IF NOT EXISTS stage_type         TEXT    NOT NULL DEFAULT 'level',
  ADD COLUMN IF NOT EXISTS level_num          INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sb                 INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bb                 INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_duration_secs INT    NOT NULL DEFAULT 1200;

-- 2. Create timer_commands table (iOS app writes here; web app reads + deletes)
CREATE TABLE IF NOT EXISTS timer_commands (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT        NOT NULL CHECK (action IN ('TOGGLE_PAUSE', 'NEXT_STAGE', 'PREV_STAGE')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE timer_commands ENABLE ROW LEVEL SECURITY;

-- 4. Allow anonymous reads, writes, and deletes (MVP — tighten later with auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'timer_commands' AND policyname = 'allow_anon_all'
  ) THEN
    CREATE POLICY allow_anon_all ON timer_commands
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Enable Realtime for timer_commands so the web app receives INSERT events
ALTER PUBLICATION supabase_realtime ADD TABLE timer_commands;
