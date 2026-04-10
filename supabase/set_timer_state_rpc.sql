-- Allow the web timer to persist canonical timer_state after timer_state RLS was tightened.
--
-- Run in Supabase SQL Editor:
--   Dashboard -> your project -> SQL Editor -> paste and Run

CREATE OR REPLACE FUNCTION set_timer_state(
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
  INSERT INTO timer_state (
    id,
    current_stage,
    anchor_ts,
    elapsed_before_pause,
    is_paused,
    is_over,
    warned_one_min,
    stage_type,
    level_num,
    sb,
    bb,
    stage_duration_secs,
    stages_json,
    source,
    updated_at
  )
  VALUES (
    'main',
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
    stages_json_arg,
    'web',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    current_stage        = EXCLUDED.current_stage,
    anchor_ts            = EXCLUDED.anchor_ts,
    elapsed_before_pause = EXCLUDED.elapsed_before_pause,
    is_paused            = EXCLUDED.is_paused,
    is_over              = EXCLUDED.is_over,
    warned_one_min       = EXCLUDED.warned_one_min,
    stage_type           = EXCLUDED.stage_type,
    level_num            = EXCLUDED.level_num,
    sb                   = EXCLUDED.sb,
    bb                   = EXCLUDED.bb,
    stage_duration_secs  = EXCLUDED.stage_duration_secs,
    stages_json          = EXCLUDED.stages_json,
    source               = EXCLUDED.source,
    updated_at           = EXCLUDED.updated_at
  RETURNING * INTO ts;

  RETURN ts;
END;
$$;

GRANT EXECUTE ON FUNCTION set_timer_state(
  INT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  BOOLEAN,
  BOOLEAN,
  BOOLEAN,
  TEXT,
  INT,
  INT,
  INT,
  INT,
  JSONB
) TO anon;
