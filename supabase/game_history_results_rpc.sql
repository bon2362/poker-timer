-- Инструкция: выполните этот файл в Supabase SQL Editor ПЕРЕД выкладкой версии 6.2.
-- Файл добавляет три защищённые операции админки. Существующие игры сам не меняет.
-- Проверьте SELECT в конце: anon/authenticated/public не могут вызывать функции,
-- service_role может. Служебный ключ остаётся только на сервере.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_game_history_results(p_session_id uuid, p_players jsonb)
RETURNS SETOF public.session_players
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_players) e WHERE (game.max_rebuys > 0 AND (e->>'rebuys')::integer > game.max_rebuys) OR (game.rebuy_cost = 0 AND (e->>'rebuys')::integer > 0) OR (game.addon_cost = 0 AND (e->>'hasAddon')::boolean))
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
$$;

CREATE OR REPLACE FUNCTION public.delete_game_history(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM id FROM public.sessions WHERE id = p_session_id AND status = 'finished' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finished game not found' USING ERRCODE = '22023'; END IF;
  UPDATE public.game_photos SET session_id = NULL WHERE session_id = p_session_id;
  DELETE FROM public.session_players WHERE session_id = p_session_id;
  DELETE FROM public.sessions WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_game_history_image(p_session_id uuid, p_session_player_id uuid, p_kind text, p_path text, p_thumb_path text)
RETURNS public.player_images LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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

REVOKE ALL ON FUNCTION public.update_game_history_results(uuid, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_game_history(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_game_history_image(uuid, uuid, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_game_history_results(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_game_history(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_game_history_image(uuid, uuid, text, text, text) TO service_role;
COMMIT;

-- Ожидается три строки: anon_can_execute=false, authenticated_can_execute=false,
-- public_can_execute=false, service_can_execute=true.
SELECT p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('update_game_history_results', 'delete_game_history', 'replace_game_history_image');
-- Ожидается язык plpgsql и security_definer=true для всех трёх функций.
SELECT proname, prosecdef AS security_definer FROM pg_proc
WHERE oid IN ('public.update_game_history_results(uuid,jsonb)'::regprocedure, 'public.delete_game_history(uuid)'::regprocedure, 'public.replace_game_history_image(uuid,uuid,text,text,text)'::regprocedure);
