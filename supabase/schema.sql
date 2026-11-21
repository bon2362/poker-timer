


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."timer_state" (
    "id" "text" DEFAULT 'main'::"text" NOT NULL,
    "current_stage" integer DEFAULT 0 NOT NULL,
    "is_paused" boolean DEFAULT true NOT NULL,
    "is_over" boolean DEFAULT false NOT NULL,
    "warned_one_min" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "anchor_ts" bigint DEFAULT 0 NOT NULL,
    "elapsed_before_pause" integer DEFAULT 0 NOT NULL,
    "stage_type" "text" DEFAULT 'level'::"text" NOT NULL,
    "level_num" integer DEFAULT 1 NOT NULL,
    "sb" integer DEFAULT 0 NOT NULL,
    "bb" integer DEFAULT 0 NOT NULL,
    "stage_duration_secs" integer DEFAULT 1200 NOT NULL,
    "stages_json" "jsonb",
    "source" "text" DEFAULT 'web'::"text" NOT NULL
);


ALTER TABLE "public"."timer_state" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_timer_stage"("expected_stage_arg" integer, "expected_anchor_ts_arg" double precision, "current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."timer_state"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."advance_timer_stage"("expected_stage_arg" integer, "expected_anchor_ts_arg" double precision, "current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_timer_command"("action" "text") RETURNS "public"."timer_state"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."apply_timer_command"("action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_game_history"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM id FROM public.sessions WHERE id = p_session_id AND status = 'finished' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finished game not found' USING ERRCODE = '22023'; END IF;
  UPDATE public.game_photos SET session_id = NULL WHERE session_id = p_session_id;
  DELETE FROM public.session_players WHERE session_id = p_session_id;
  DELETE FROM public.sessions WHERE id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."delete_game_history"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_timer_event"("device_id_arg" "text", "device_arg" "text", "kind_arg" "text", "cause_arg" "text", "from_stage_arg" integer, "to_stage_arg" integer, "details_arg" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_timer_event"("device_id_arg" "text", "device_arg" "text", "kind_arg" "text", "cause_arg" "text", "from_stage_arg" integer, "to_stage_arg" integer, "details_arg" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buy_in" integer NOT NULL,
    "initial_stack" integer NOT NULL,
    "rebuy_cost" integer DEFAULT 0 NOT NULL,
    "rebuy_chips" integer DEFAULT 0 NOT NULL,
    "addon_cost" integer DEFAULT 0 NOT NULL,
    "addon_chips" integer DEFAULT 0 NOT NULL,
    "prize_spots" integer DEFAULT 1 NOT NULL,
    "prize_pcts" integer[] NOT NULL,
    "status" "text" DEFAULT 'setup'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "max_rebuys" integer DEFAULT 0 NOT NULL,
    "number_of_tables" integer DEFAULT 1 NOT NULL,
    "merge_threshold" integer DEFAULT 0 NOT NULL,
    "tables_merged_at" timestamp with time zone,
    "slug" "text",
    "finished_at" timestamp with time zone,
    "finished_at_approximate" boolean DEFAULT false NOT NULL,
    "blind_structure" "jsonb",
    "started_at" timestamp with time zone
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_tables"("p_session_id" "uuid") RETURNS "public"."sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  merged_session sessions;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id AND status = 'active') THEN
    RAISE EXCEPTION 'Active session % not found', p_session_id;
  END IF;

  UPDATE session_players
  SET table_number = 1
  WHERE session_id = p_session_id;

  UPDATE sessions
  SET tables_merged_at = COALESCE(tables_merged_at, NOW())
  WHERE id = p_session_id
  RETURNING * INTO merged_session;

  RETURN merged_session;
END;
$$;


ALTER FUNCTION "public"."merge_tables"("p_session_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "path" "text" NOT NULL,
    "thumb_path" "text",
    "is_current" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_images_kind_check" CHECK (("kind" = ANY (ARRAY['loser'::"text", 'winner'::"text"])))
);


ALTER TABLE "public"."player_images" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_game_history_image"("p_session_id" "uuid", "p_session_player_id" "uuid", "p_kind" "text", "p_path" "text", "p_thumb_path" "text") RETURNS "public"."player_images"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE participant public.session_players%ROWTYPE; image public.player_images%ROWTYPE;
BEGIN
  PERFORM id FROM public.sessions WHERE id = p_session_id AND status = 'finished' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finished game not found' USING ERRCODE = '22023'; END IF;
  SELECT * INTO participant FROM public.session_players WHERE id = p_session_player_id AND session_id = p_session_id FOR UPDATE;
  IF NOT FOUND OR p_kind NOT IN ('winner', 'loser') OR p_path IS NULL OR p_thumb_path IS NULL THEN
    RAISE EXCEPTION 'Invalid historical image' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.player_images (player_id, kind, path, thumb_path, is_current)
  VALUES (participant.player_id, p_kind, p_path, p_thumb_path, false) RETURNING * INTO image;
  IF p_kind = 'winner' THEN UPDATE public.session_players SET winner_image_id = image.id WHERE id = participant.id;
  ELSE UPDATE public.session_players SET loser_image_id = image.id WHERE id = participant.id; END IF;
  RETURN image;
END;
$$;


ALTER FUNCTION "public"."replace_game_history_image"("p_session_id" "uuid", "p_session_player_id" "uuid", "p_kind" "text", "p_path" "text", "p_thumb_path" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "id" "text" DEFAULT 'main'::"text" NOT NULL,
    "config_json" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_app_config"("config_json_arg" "jsonb") RETURNS "public"."app_config"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cfg app_config;
BEGIN
  INSERT INTO app_config (
    id,
    config_json,
    updated_at
  )
  VALUES (
    'main',
    config_json_arg,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    config_json = EXCLUDED.config_json,
    updated_at  = EXCLUDED.updated_at
  RETURNING * INTO cfg;

  RETURN cfg;
END;
$$;


ALTER FUNCTION "public"."set_app_config"("config_json_arg" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."minute_timer_state" (
    "id" "text" DEFAULT 'main'::"text" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "player_name" "text" DEFAULT ''::"text" NOT NULL,
    "player_id" "text" DEFAULT ''::"text" NOT NULL,
    "end_ts" double precision DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."minute_timer_state" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_minute_timer_state"("active_arg" boolean, "player_name_arg" "text", "player_id_arg" "text", "end_ts_arg" double precision) RETURNS "public"."minute_timer_state"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."set_minute_timer_state"("active_arg" boolean, "player_name_arg" "text", "player_id_arg" "text", "end_ts_arg" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_timer_state"("current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."timer_state"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."set_timer_state"("current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."timer_state_log_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."timer_state_log_trigger"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "rebuys" integer DEFAULT 0 NOT NULL,
    "has_addon" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'playing'::"text" NOT NULL,
    "finish_position" integer,
    "eliminated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_number" integer DEFAULT 1 NOT NULL,
    "payout" integer,
    "loser_image_id" "uuid",
    "winner_image_id" "uuid"
);


ALTER TABLE "public"."session_players" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_game_history_results"("p_session_id" "uuid", "p_players" "jsonb") RETURNS SETOF "public"."session_players"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  game public.sessions%ROWTYPE;
  participant_count integer;
  bank bigint;
  remaining bigint;
  payout_value bigint;
  position integer;
  percentages jsonb;
BEGIN
  SELECT * INTO game FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR game.status <> 'finished' THEN
    RAISE EXCEPTION 'Finished game not found' USING ERRCODE = '22023';
  END IF;
  -- The game row serializes result edits, deletion and historical image replacement.
  PERFORM id FROM public.session_players WHERE session_id = p_session_id FOR UPDATE;
  SELECT count(*) INTO participant_count FROM public.session_players WHERE session_id = p_session_id;
  IF jsonb_typeof(p_players) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Players must be an array' USING ERRCODE = '22023';
  END IF;
  IF participant_count = 0 OR jsonb_array_length(p_players) <> participant_count THEN
    RAISE EXCEPTION 'Complete participant list required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_players) e
    WHERE jsonb_typeof(e->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(e->'finishPosition') IS DISTINCT FROM 'number'
      OR (e->>'finishPosition') !~ '^[1-9][0-9]*$'
      OR jsonb_typeof(e->'rebuys') IS DISTINCT FROM 'number'
      OR (e->>'rebuys') !~ '^[0-9]+$'
      OR jsonb_typeof(e->'hasAddon') IS DISTINCT FROM 'boolean'
  ) THEN RAISE EXCEPTION 'Invalid player values' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(p_players) e) <> participant_count
    OR (SELECT count(DISTINCT (e->>'finishPosition')::integer) FROM jsonb_array_elements(p_players) e) <> participant_count
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_players) e WHERE (e->>'finishPosition')::integer NOT BETWEEN 1 AND participant_count)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_players) e LEFT JOIN public.session_players sp ON sp.id = (e->>'id')::uuid AND sp.session_id = p_session_id WHERE sp.id IS NULL)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_players) e WHERE (game.max_rebuys > 0 AND (e->>'rebuys')::integer > game.max_rebuys AND (e->>'rebuys')::integer > (SELECT sp2.rebuys FROM public.session_players sp2 WHERE sp2.id = (e->>'id')::uuid)) OR (game.rebuy_cost = 0 AND (e->>'rebuys')::integer > 0) OR (game.addon_cost = 0 AND (e->>'hasAddon')::boolean))
  THEN RAISE EXCEPTION 'Invalid places, participants or rebuys' USING ERRCODE = '22023'; END IF;
  -- Works for both PostgreSQL ARRAY and JSON/JSONB prize_pcts.
  percentages := to_jsonb(game.prize_pcts);
  IF game.prize_spots < 1 OR game.prize_spots > participant_count
    OR jsonb_typeof(percentages) IS DISTINCT FROM 'array'
    OR jsonb_array_length(percentages) <> game.prize_spots
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(percentages) p WHERE jsonb_typeof(p) <> 'number' OR p::text::numeric < 0)
    OR (SELECT sum(p::text::numeric) FROM jsonb_array_elements(percentages) p) <> 100
  THEN RAISE EXCEPTION 'Invalid prize configuration' USING ERRCODE = '22023'; END IF;
  SELECT participant_count * game.buy_in::bigint + sum((e->>'rebuys')::bigint) * game.rebuy_cost + count(*) FILTER (WHERE (e->>'hasAddon')::boolean) * game.addon_cost
    INTO bank FROM jsonb_array_elements(p_players) e;
  remaining := bank;
  UPDATE public.session_players sp SET
    finish_position = (e->>'finishPosition')::integer,
    rebuys = (e->>'rebuys')::integer,
    has_addon = (e->>'hasAddon')::boolean,
    status = CASE WHEN (e->>'finishPosition')::integer = 1 THEN 'winner' ELSE 'eliminated' END,
    payout = 0
  FROM jsonb_array_elements(p_players) e WHERE sp.id = (e->>'id')::uuid AND sp.session_id = p_session_id;
  FOR position IN 1..game.prize_spots LOOP
    payout_value := CASE WHEN position = game.prize_spots THEN remaining ELSE floor(bank * (percentages->>(position - 1))::numeric / 100)::bigint END;
    UPDATE public.session_players SET payout = payout_value WHERE session_id = p_session_id AND finish_position = position;
    remaining := remaining - payout_value;
  END LOOP;
  -- The session slug, timestamps and all image snapshots remain untouched.
  RETURN QUERY SELECT * FROM public.session_players WHERE session_id = p_session_id ORDER BY finish_position;
END;
$_$;


ALTER FUNCTION "public"."update_game_history_results"("p_session_id" "uuid", "p_players" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_push_token"("p_token" "text", "p_platform" "text" DEFAULT 'ios_live_activity'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO push_tokens (token, platform)
  VALUES (p_token, p_platform)
  ON CONFLICT (token)
  DO UPDATE SET updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."upsert_push_token"("p_token" "text", "p_platform" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "path" "text" NOT NULL,
    "thumb_path" "text",
    "taken_at" timestamp with time zone,
    "width" integer,
    "height" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."game_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" DEFAULT 'ios_live_activity'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timer_commands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "timer_commands_action_check" CHECK (("action" = ANY (ARRAY['TOGGLE_PAUSE'::"text", 'NEXT_STAGE'::"text", 'PREV_STAGE'::"text"])))
);


ALTER TABLE "public"."timer_commands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timer_events" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "device" "text",
    "kind" "text" NOT NULL,
    "cause" "text",
    "from_stage" integer,
    "to_stage" integer,
    "details" "jsonb"
);


ALTER TABLE "public"."timer_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."timer_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."timer_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."timer_events_id_seq" OWNED BY "public"."timer_events"."id";



ALTER TABLE ONLY "public"."timer_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."timer_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_photos"
    ADD CONSTRAINT "game_photos_path_key" UNIQUE ("path");



ALTER TABLE ONLY "public"."game_photos"
    ADD CONSTRAINT "game_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."minute_timer_state"
    ADD CONSTRAINT "minute_timer_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_images"
    ADD CONSTRAINT "player_images_path_key" UNIQUE ("path");



ALTER TABLE ONLY "public"."player_images"
    ADD CONSTRAINT "player_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."session_players"
    ADD CONSTRAINT "session_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."timer_commands"
    ADD CONSTRAINT "timer_commands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timer_events"
    ADD CONSTRAINT "timer_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timer_state"
    ADD CONSTRAINT "timer_state_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "player_images_current_kind_idx" ON "public"."player_images" USING "btree" ("player_id", "kind") WHERE "is_current";



CREATE INDEX "timer_events_created_at_idx" ON "public"."timer_events" USING "btree" ("created_at");



CREATE OR REPLACE TRIGGER "timer_state_log" AFTER INSERT OR UPDATE ON "public"."timer_state" FOR EACH ROW EXECUTE FUNCTION "public"."timer_state_log_trigger"();



ALTER TABLE ONLY "public"."game_photos"
    ADD CONSTRAINT "game_photos_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."player_images"
    ADD CONSTRAINT "player_images_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."session_players"
    ADD CONSTRAINT "session_players_loser_image_id_fkey" FOREIGN KEY ("loser_image_id") REFERENCES "public"."player_images"("id");



ALTER TABLE ONLY "public"."session_players"
    ADD CONSTRAINT "session_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_players"
    ADD CONSTRAINT "session_players_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_players"
    ADD CONSTRAINT "session_players_winner_image_id_fkey" FOREIGN KEY ("winner_image_id") REFERENCES "public"."player_images"("id");



CREATE POLICY "allow_anon_insert" ON "public"."timer_commands" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow_anon_select" ON "public"."timer_state" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_select_app_config" ON "public"."app_config" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_select_minute_timer_state" ON "public"."minute_timer_state" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow_anon_upsert" ON "public"."push_tokens" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "anon insert active session players" ON "public"."session_players" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_players"."session_id") AND ("s"."status" = 'active'::"text")))));



CREATE POLICY "anon insert active sessions" ON "public"."sessions" FOR INSERT TO "authenticated", "anon" WITH CHECK (("status" = 'active'::"text"));



CREATE POLICY "anon insert players" ON "public"."players" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "anon read game photos" ON "public"."game_photos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon read player images" ON "public"."player_images" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon update active session players" ON "public"."session_players" FOR UPDATE TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_players"."session_id") AND ("s"."status" = 'active'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_players"."session_id") AND ("s"."status" = 'active'::"text")))));



CREATE POLICY "anon update active sessions" ON "public"."sessions" FOR UPDATE TO "authenticated", "anon" USING (("status" = 'active'::"text")) WITH CHECK (("status" = 'active'::"text"));



CREATE POLICY "anon update players" ON "public"."players" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."minute_timer_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read players" ON "public"."players" FOR SELECT USING (true);



CREATE POLICY "public read sessions" ON "public"."sessions" FOR SELECT USING (true);



CREATE POLICY "public read sp" ON "public"."session_players" FOR SELECT USING (true);



ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timer_commands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timer_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timer_state" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."timer_state" TO "anon";
GRANT ALL ON TABLE "public"."timer_state" TO "authenticated";
GRANT ALL ON TABLE "public"."timer_state" TO "service_role";



GRANT ALL ON FUNCTION "public"."advance_timer_stage"("expected_stage_arg" integer, "expected_anchor_ts_arg" double precision, "current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_timer_stage"("expected_stage_arg" integer, "expected_anchor_ts_arg" double precision, "current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_timer_stage"("expected_stage_arg" integer, "expected_anchor_ts_arg" double precision, "current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_timer_command"("action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_timer_command"("action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_timer_command"("action" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_game_history"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_game_history"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_timer_event"("device_id_arg" "text", "device_arg" "text", "kind_arg" "text", "cause_arg" "text", "from_stage_arg" integer, "to_stage_arg" integer, "details_arg" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_timer_event"("device_id_arg" "text", "device_arg" "text", "kind_arg" "text", "cause_arg" "text", "from_stage_arg" integer, "to_stage_arg" integer, "details_arg" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_timer_event"("device_id_arg" "text", "device_arg" "text", "kind_arg" "text", "cause_arg" "text", "from_stage_arg" integer, "to_stage_arg" integer, "details_arg" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_tables"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_tables"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_tables"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."player_images" TO "anon";
GRANT ALL ON TABLE "public"."player_images" TO "authenticated";
GRANT ALL ON TABLE "public"."player_images" TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_game_history_image"("p_session_id" "uuid", "p_session_player_id" "uuid", "p_kind" "text", "p_path" "text", "p_thumb_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_game_history_image"("p_session_id" "uuid", "p_session_player_id" "uuid", "p_kind" "text", "p_path" "text", "p_thumb_path" "text") TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_app_config"("config_json_arg" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."set_app_config"("config_json_arg" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_app_config"("config_json_arg" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."minute_timer_state" TO "anon";
GRANT ALL ON TABLE "public"."minute_timer_state" TO "authenticated";
GRANT ALL ON TABLE "public"."minute_timer_state" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_minute_timer_state"("active_arg" boolean, "player_name_arg" "text", "player_id_arg" "text", "end_ts_arg" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."set_minute_timer_state"("active_arg" boolean, "player_name_arg" "text", "player_id_arg" "text", "end_ts_arg" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_minute_timer_state"("active_arg" boolean, "player_name_arg" "text", "player_id_arg" "text", "end_ts_arg" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_timer_state"("current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."set_timer_state"("current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timer_state"("current_stage_arg" integer, "anchor_ts_arg" double precision, "elapsed_before_pause_arg" double precision, "is_paused_arg" boolean, "is_over_arg" boolean, "warned_one_min_arg" boolean, "stage_type_arg" "text", "level_num_arg" integer, "sb_arg" integer, "bb_arg" integer, "stage_duration_secs_arg" integer, "stages_json_arg" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."timer_state_log_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."timer_state_log_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."timer_state_log_trigger"() TO "service_role";



GRANT ALL ON TABLE "public"."session_players" TO "anon";
GRANT ALL ON TABLE "public"."session_players" TO "authenticated";
GRANT ALL ON TABLE "public"."session_players" TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_game_history_results"("p_session_id" "uuid", "p_players" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_game_history_results"("p_session_id" "uuid", "p_players" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text", "p_platform" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text", "p_platform" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_token" "text", "p_platform" "text") TO "service_role";



GRANT ALL ON TABLE "public"."game_photos" TO "anon";
GRANT ALL ON TABLE "public"."game_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."game_photos" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."timer_commands" TO "anon";
GRANT ALL ON TABLE "public"."timer_commands" TO "authenticated";
GRANT ALL ON TABLE "public"."timer_commands" TO "service_role";



GRANT ALL ON TABLE "public"."timer_events" TO "anon";
GRANT ALL ON TABLE "public"."timer_events" TO "authenticated";
GRANT ALL ON TABLE "public"."timer_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."timer_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."timer_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."timer_events_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







