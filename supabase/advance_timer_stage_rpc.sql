-- Conditional auto-advance: a client whose round ran out asks the DB to move to the next round
-- only if the DB still holds the round it was counting (same stage, same anchor, running).
-- A device with an outdated view (slept, lost its connection, missed a pause) is refused and
-- receives the current row instead, so it can no longer pull other devices to a wrong round.
--
-- Run in Supabase SQL Editor (prod and poker-timer-test).

CREATE OR REPLACE FUNCTION advance_timer_stage(
  expected_stage_arg INT,
  expected_anchor_ts_arg DOUBLE PRECISION,
  current_stage_arg INT,
  anchor_ts_arg DOUBLE PRECISION,
  elapsed_before_pause_arg DOUBLE PRECISION,
  is_paused_arg BOOLEAN,
  is_over_arg BOOLEAN,
  warned_one_min_arg BOOLEAN,
  stage_type_arg TEXT,
  level_num_arg INT,
  sb_arg INT,
  bb_arg INT,
  stage_duration_secs_arg INT,
  stages_json_arg JSONB DEFAULT NULL
)
RETURNS timer_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts timer_state;
BEGIN
  SELECT * INTO ts FROM timer_state WHERE id = 'main' FOR UPDATE;

  IF FOUND AND (
    ts.current_stage IS DISTINCT FROM expected_stage_arg
    OR ts.anchor_ts IS DISTINCT FROM expected_anchor_ts_arg
    OR ts.is_paused
    OR ts.is_over
  ) THEN
    -- Someone else already changed the timer: refuse and hand back the current state.
    RETURN ts;
  END IF;

  RETURN set_timer_state(
    current_stage_arg,
    anchor_ts_arg,
    elapsed_before_pause_arg,
    is_paused_arg,
    is_over_arg,
    warned_one_min_arg,
    stage_type_arg,
    level_num_arg,
    sb_arg,
    bb_arg,
    stage_duration_secs_arg,
    stages_json_arg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION advance_timer_stage(
  INT, DOUBLE PRECISION, INT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, BOOLEAN, BOOLEAN,
  TEXT, INT, INT, INT, INT, JSONB
) TO anon;
