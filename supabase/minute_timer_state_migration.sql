-- Durable state for the "Минуту!" countdown.
--
-- Run in Supabase SQL Editor:
--   Dashboard -> your project -> SQL Editor -> paste and Run

CREATE TABLE IF NOT EXISTS minute_timer_state (
  id          TEXT             PRIMARY KEY DEFAULT 'main',
  active      BOOLEAN          NOT NULL DEFAULT FALSE,
  player_name TEXT             NOT NULL DEFAULT '',
  player_id   TEXT             NOT NULL DEFAULT '',
  end_ts      DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE minute_timer_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'minute_timer_state' AND policyname = 'allow_anon_select_minute_timer_state'
  ) THEN
    CREATE POLICY allow_anon_select_minute_timer_state ON minute_timer_state
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_minute_timer_state(
  active_arg BOOLEAN,
  player_name_arg TEXT,
  player_id_arg TEXT,
  end_ts_arg DOUBLE PRECISION
)
RETURNS minute_timer_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mts minute_timer_state;
BEGIN
  INSERT INTO minute_timer_state (
    id,
    active,
    player_name,
    player_id,
    end_ts,
    updated_at
  )
  VALUES (
    'main',
    active_arg,
    COALESCE(player_name_arg, ''),
    COALESCE(player_id_arg, ''),
    COALESCE(end_ts_arg, 0),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    active      = EXCLUDED.active,
    player_name = EXCLUDED.player_name,
    player_id   = EXCLUDED.player_id,
    end_ts      = EXCLUDED.end_ts,
    updated_at  = EXCLUDED.updated_at
  RETURNING * INTO mts;

  RETURN mts;
END;
$$;

GRANT EXECUTE ON FUNCTION set_minute_timer_state(
  BOOLEAN,
  TEXT,
  TEXT,
  DOUBLE PRECISION
) TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'minute_timer_state'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE minute_timer_state';
  END IF;
END $$;
