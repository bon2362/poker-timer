-- Инструкция: выполните этот файл целиком после проверки всех экранов истории игр и не в день игры.
-- Что делает: публичный ключ больше не может менять завершённые игры, удалять игры, участников и игроков,
-- а также записывать и удалять файлы. Активная игра, таймер и просмотр страниц продолжают работать.
-- Откат: раздел ОТКАТ в конце файла. Выполните его, если таймер или панель перестанут сохранять действия.
BEGIN;

DROP POLICY IF EXISTS "public write sessions" ON public.sessions;
DROP POLICY IF EXISTS "public write sp" ON public.session_players;
DROP POLICY IF EXISTS "public write players" ON public.players;

DROP POLICY IF EXISTS "anon insert active sessions" ON public.sessions;
CREATE POLICY "anon insert active sessions" ON public.sessions FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'active');
DROP POLICY IF EXISTS "anon update active sessions" ON public.sessions;
CREATE POLICY "anon update active sessions" ON public.sessions FOR UPDATE TO anon, authenticated
  USING (status = 'active') WITH CHECK (status = 'active');

DROP POLICY IF EXISTS "anon insert active session players" ON public.session_players;
CREATE POLICY "anon insert active session players" ON public.session_players FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_players.session_id AND s.status = 'active'));
DROP POLICY IF EXISTS "anon update active session players" ON public.session_players;
CREATE POLICY "anon update active session players" ON public.session_players FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_players.session_id AND s.status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_players.session_id AND s.status = 'active'));

DROP POLICY IF EXISTS "anon insert players" ON public.players;
CREATE POLICY "anon insert players" ON public.players FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon update players" ON public.players;
CREATE POLICY "anon update players" ON public.players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Файлы: остаётся только чтение. Новые файлы загружаются по подписанным ссылкам из /api/admin/uploads/sign.
DROP POLICY IF EXISTS "allow public select 1lvgmcu_1" ON storage.objects;
DROP POLICY IF EXISTS "allow public select 1lvgmcu_2" ON storage.objects;
DROP POLICY IF EXISTS "public avatar update" ON storage.objects;
DROP POLICY IF EXISTS "public avatar upload" ON storage.objects;

-- Функция выполняется с правами владельца и обходит правила выше, поэтому проверяет игру сама.
CREATE OR REPLACE FUNCTION public.merge_tables(p_session_id uuid)
RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
$function$;

COMMIT;

-- Ожидается: у sessions, session_players и players нет строк с cmd = ALL и нет DELETE.
-- У storage.objects только SELECT (две строки: slideshow и avatars).
SELECT schemaname, tablename, policyname, cmd FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('sessions', 'session_players', 'players')) OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY 1, 2, 4, 3;

-- ОТКАТ: выполните этот блок целиком, сняв комментарии.
-- BEGIN;
-- DROP POLICY IF EXISTS "anon insert active sessions" ON public.sessions;
-- DROP POLICY IF EXISTS "anon update active sessions" ON public.sessions;
-- DROP POLICY IF EXISTS "anon insert active session players" ON public.session_players;
-- DROP POLICY IF EXISTS "anon update active session players" ON public.session_players;
-- DROP POLICY IF EXISTS "anon insert players" ON public.players;
-- DROP POLICY IF EXISTS "anon update players" ON public.players;
-- CREATE POLICY "public write sessions" ON public.sessions FOR ALL TO public USING (true);
-- CREATE POLICY "public write sp" ON public.session_players FOR ALL TO public USING (true);
-- CREATE POLICY "public write players" ON public.players FOR ALL TO public USING (true);
-- CREATE POLICY "allow public select 1lvgmcu_1" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'slideshow');
-- CREATE POLICY "allow public select 1lvgmcu_2" ON storage.objects FOR DELETE TO public USING (bucket_id = 'slideshow');
-- CREATE POLICY "public avatar update" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'avatars');
-- CREATE POLICY "public avatar upload" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'avatars');
-- CREATE OR REPLACE FUNCTION public.merge_tables(p_session_id uuid)
-- RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
-- DECLARE merged_session sessions;
-- BEGIN
--   UPDATE session_players SET table_number = 1 WHERE session_id = p_session_id;
--   UPDATE sessions SET tables_merged_at = COALESCE(tables_merged_at, NOW()) WHERE id = p_session_id RETURNING * INTO merged_session;
--   IF NOT FOUND THEN RAISE EXCEPTION 'Session % not found', p_session_id; END IF;
--   RETURN merged_session;
-- END;
-- $function$;
-- COMMIT;
