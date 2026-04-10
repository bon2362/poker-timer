-- Ф3: Backend command processing via Postgres RPC
-- Eliminates the dependency on an open web client for iOS timer control.
--
-- Run in Supabase SQL Editor:
--   Dashboard → your project → SQL Editor → paste and Run

-- 1. Add stages_json: stores the full stage list so the RPC can navigate stages
--    without knowing the app config (which lives in localStorage)
ALTER TABLE timer_state
  ADD COLUMN IF NOT EXISTS stages_json JSONB;

-- 2. Add source: distinguishes iOS RPC writes from web writes (echo suppression)
ALTER TABLE timer_state
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

-- 3. Core RPC: atomically applies a timer command and updates timer_state
CREATE OR REPLACE FUNCTION apply_timer_command(action TEXT)
RETURNS timer_state
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ts         timer_state;
  now_ms     DOUBLE PRECISION;
  elapsed    DOUBLE PRECISION;
  stage_idx  INT;
  stage_info JSONB;
BEGIN
  now_ms := EXTRACT(EPOCH FROM clock_timestamp()) * 1000;

  -- Lock the row to prevent concurrent command races
  SELECT * INTO ts FROM timer_state WHERE id = 'main' FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'timer_state row "main" not found';
  END IF;

  CASE action

    WHEN 'TOGGLE_PAUSE' THEN
      IF ts.is_paused THEN
        -- Resume: anchor to current server time
        ts.is_paused := FALSE;
        ts.anchor_ts := now_ms;
      ELSE
        -- Pause: accumulate elapsed seconds
        elapsed := FLOOR((now_ms - ts.anchor_ts) / 1000.0);
        ts.elapsed_before_pause := ts.elapsed_before_pause + elapsed;
        ts.is_paused := TRUE;
      END IF;

    WHEN 'NEXT_STAGE' THEN
      stage_idx := ts.current_stage + 1;
      IF ts.stages_json IS NOT NULL
         AND stage_idx < jsonb_array_length(ts.stages_json)
      THEN
        stage_info       := ts.stages_json -> stage_idx;
        ts.current_stage := stage_idx;
        ts.anchor_ts     := now_ms;
        ts.elapsed_before_pause := 0;
        ts.warned_one_min := FALSE;
        ts.stage_type    := stage_info ->> 'type';
        ts.stage_duration_secs := (stage_info ->> 'duration')::INT;
        IF ts.stage_type = 'level' THEN
          ts.level_num := (stage_info ->> 'levelNum')::INT;
          ts.sb        := (stage_info ->> 'sb')::INT;
          ts.bb        := (stage_info ->> 'bb')::INT;
        ELSE
          ts.level_num := 0;
          ts.sb        := 0;
          ts.bb        := 0;
        END IF;
      END IF;
      -- No-op if at last stage or stages_json not yet populated

    WHEN 'PREV_STAGE' THEN
      stage_idx := ts.current_stage - 1;
      IF ts.stages_json IS NOT NULL AND stage_idx >= 0 THEN
        stage_info       := ts.stages_json -> stage_idx;
        ts.current_stage := stage_idx;
        ts.anchor_ts     := now_ms;
        ts.elapsed_before_pause := 0;
        ts.warned_one_min := FALSE;
        ts.stage_type    := stage_info ->> 'type';
        ts.stage_duration_secs := (stage_info ->> 'duration')::INT;
        IF ts.stage_type = 'level' THEN
          ts.level_num := (stage_info ->> 'levelNum')::INT;
          ts.sb        := (stage_info ->> 'sb')::INT;
          ts.bb        := (stage_info ->> 'bb')::INT;
        ELSE
          ts.level_num := 0;
          ts.sb        := 0;
          ts.bb        := 0;
        END IF;
      END IF;

    ELSE
      RAISE EXCEPTION 'Unknown command: %', action;
  END CASE;

  UPDATE timer_state SET
    is_paused            = ts.is_paused,
    anchor_ts            = ts.anchor_ts,
    elapsed_before_pause = ts.elapsed_before_pause,
    current_stage        = ts.current_stage,
    warned_one_min       = ts.warned_one_min,
    stage_type           = ts.stage_type,
    stage_duration_secs  = ts.stage_duration_secs,
    level_num            = ts.level_num,
    sb                   = ts.sb,
    bb                   = ts.bb,
    source               = 'ios',
    updated_at           = NOW()
  WHERE id = 'main'
  RETURNING * INTO ts;

  RETURN ts;
END;
$$;

-- 4. Allow anonymous users to call the function (iOS app uses anon key)
GRANT EXECUTE ON FUNCTION apply_timer_command(TEXT) TO anon;

-- 5. Ensure anon can SELECT timer_state (required for Realtime postgres_changes + iOS polling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'timer_state' AND policyname = 'allow_anon_select'
  ) THEN
    ALTER TABLE timer_state ENABLE ROW LEVEL SECURITY;
    CREATE POLICY allow_anon_select ON timer_state
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 6. Tighten timer_commands RLS: drop overly broad policy, allow INSERT only
--    (timer_commands is kept as a fallback but should not be readable/deletable by anon)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'timer_commands' AND policyname = 'allow_anon_all'
  ) THEN
    DROP POLICY allow_anon_all ON timer_commands;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'timer_commands' AND policyname = 'allow_anon_insert'
  ) THEN
    CREATE POLICY allow_anon_insert ON timer_commands
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
