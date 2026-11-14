-- Timer event log: who/what changed the round, to investigate unexpected stage jumps.
--
-- Two writers:
--   1. Web clients call log_timer_event(...) with the cause of every local timer change
--      (button, auto-advance, state received from another device, page load, ...).
--   2. A trigger on timer_state records every DB write with its source ('web' / 'ios').
--
-- Run in Supabase SQL Editor (prod and poker-timer-test):
--   Dashboard -> your project -> SQL Editor -> paste and Run

CREATE TABLE IF NOT EXISTS timer_events (
  id          BIGSERIAL   PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id   TEXT,
  device      TEXT,
  kind        TEXT        NOT NULL,
  cause       TEXT,
  from_stage  INT,
  to_stage    INT,
  details     JSONB
);

CREATE INDEX IF NOT EXISTS timer_events_created_at_idx ON timer_events (created_at);

-- No direct anon access: inserts only through the function below, reads only with service key.
ALTER TABLE timer_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION log_timer_event(
  device_id_arg  TEXT,
  device_arg     TEXT,
  kind_arg       TEXT,
  cause_arg      TEXT,
  from_stage_arg INT,
  to_stage_arg   INT,
  details_arg    JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO timer_events (device_id, device, kind, cause, from_stage, to_stage, details)
  VALUES (
    LEFT(device_id_arg, 64),
    LEFT(device_arg, 200),
    LEFT(kind_arg, 64),
    LEFT(cause_arg, 64),
    from_stage_arg,
    to_stage_arg,
    details_arg
  );

  -- Occasional cleanup: keep 60 days.
  IF random() < 0.02 THEN
    DELETE FROM timer_events WHERE created_at < NOW() - INTERVAL '60 days';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION log_timer_event(TEXT, TEXT, TEXT, TEXT, INT, INT, JSONB) TO anon;

CREATE OR REPLACE FUNCTION timer_state_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO timer_events (device, kind, cause, from_stage, to_stage, details)
  VALUES (
    'db',
    'db_write',
    NEW.source,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.current_stage END,
    NEW.current_stage,
    jsonb_build_object(
      'isPaused', NEW.is_paused,
      'wasPaused', CASE WHEN TG_OP = 'UPDATE' THEN OLD.is_paused END,
      'isOver', NEW.is_over,
      'anchorTs', NEW.anchor_ts,
      'elapsedBeforePause', NEW.elapsed_before_pause
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timer_state_log ON timer_state;
CREATE TRIGGER timer_state_log
  AFTER INSERT OR UPDATE ON timer_state
  FOR EACH ROW EXECUTE FUNCTION timer_state_log_trigger();
