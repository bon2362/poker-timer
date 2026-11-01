-- Инструкция: выполните этот файл в Supabase SQL Editor после game_history_migration.sql.
-- Все ожидаемые итоги проверяются до COMMIT: несовпадение прерывает транзакцию.
-- После успешного выполнения итоговый SELECT показывает сохранённый результат. Файлы Storage не меняются.

BEGIN;

CREATE TABLE IF NOT EXISTS public.backup_20261101_sessions AS SELECT * FROM public.sessions;
CREATE TABLE IF NOT EXISTS public.backup_20261101_session_players AS SELECT * FROM public.session_players;
ALTER TABLE public.backup_20261101_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_20261101_session_players ENABLE ROW LEVEL SECURITY;

CREATE TEMP TABLE true_games ON COMMIT DROP AS
SELECT s.id, (s.created_at AT TIME ZONE 'Europe/Belgrade')::date AS game_date
FROM public.sessions s
JOIN public.session_players sp ON sp.session_id = s.id
GROUP BY s.id, s.created_at
HAVING ((s.created_at AT TIME ZONE 'Europe/Belgrade')::date, count(*), coalesce(sum(sp.rebuys), 0), count(*) FILTER (WHERE sp.has_addon)) IN (
  ('2026-05-10'::date, 10, 3, 10),
  ('2026-10-31'::date, 8, 4, 7)
);

DO $$
BEGIN
  IF (SELECT count(*) FROM true_games) <> 2 THEN
    RAISE EXCEPTION 'Найдены не ровно две настоящие игры: %', (SELECT count(*) FROM true_games);
  END IF;
END $$;

DELETE FROM public.session_players WHERE session_id NOT IN (SELECT id FROM true_games);
DELETE FROM public.sessions WHERE id NOT IN (SELECT id FROM true_games);

WITH ranked AS (
  SELECT sp.id, sp.session_id, sp.finish_position,
    s.buy_in * count(*) OVER (PARTITION BY sp.session_id)
      + s.rebuy_cost * sum(sp.rebuys) OVER (PARTITION BY sp.session_id)
      + s.addon_cost * count(*) FILTER (WHERE sp.has_addon) OVER (PARTITION BY sp.session_id) AS bank,
    s.prize_spots, to_jsonb(s.prize_pcts) AS prize_pcts
  FROM public.session_players sp
  JOIN public.sessions s ON s.id = sp.session_id
), payouts AS (
  SELECT id,
    CASE
      WHEN finish_position IS NULL OR finish_position > prize_spots THEN 0
      WHEN finish_position < prize_spots THEN floor(bank * (prize_pcts ->> (finish_position - 1))::numeric / 100)::integer
      ELSE bank - sum(floor(bank * (prize_pcts ->> (finish_position - 1))::numeric / 100)::integer)
        FILTER (WHERE finish_position < prize_spots) OVER (PARTITION BY session_id)
    END AS payout
  FROM ranked
)
UPDATE public.session_players sp SET payout = payouts.payout FROM payouts WHERE sp.id = payouts.id;

UPDATE public.sessions s
SET finished_at = last_elimination.eliminated_at,
    finished_at_approximate = true,
    slug = CASE tg.game_date
      WHEN '2026-05-10'::date THEN '2026-may-10'
      WHEN '2026-10-31'::date THEN '2026-october-31'
    END
FROM true_games tg
CROSS JOIN LATERAL (
  SELECT max(eliminated_at) AS eliminated_at FROM public.session_players WHERE session_id = tg.id
) last_elimination
WHERE s.id = tg.id;

-- Имена с @ содержат местное время Белграда. Альтернативные имена
-- 1793312953591-10-05-2026-photo_10413_0.jpg содержат только дату.
INSERT INTO public.game_photos (session_id, path, taken_at)
SELECT
  CASE WHEN o.name ~* '^[0-9]+-10-05-2026-photo_[0-9]+_[0-9]+\.(jpg|jpeg|png|webp|gif|avif|bmp)$'
    THEN (SELECT id FROM true_games WHERE game_date = '2026-05-10'::date)
  END,
  o.name,
  to_timestamp(substring(o.name FROM '@([0-9]{2}-[0-9]{2}-[0-9]{4}_[0-9]{2}-[0-9]{2}-[0-9]{2})'), 'DD-MM-YYYY_HH24-MI-SS')::timestamp AT TIME ZONE 'Europe/Belgrade'
FROM storage.objects o
WHERE o.bucket_id = 'slideshow'
  AND o.name ~* '\.(jpg|jpeg|png|webp|gif|avif|bmp)$'
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.player_images (player_id, kind, path, thumb_path, is_current)
SELECT
  (substring(o.name FROM '^(?:winner|loser)-([0-9a-fA-F-]{36})\.jpg$'))::uuid,
  substring(o.name FROM '^(winner|loser)-'),
  o.name,
  CASE WHEN EXISTS (
    SELECT 1 FROM storage.objects thumb
    WHERE thumb.bucket_id = 'avatars'
      AND thumb.name = regexp_replace(o.name, '\.jpg$', '-thumb.jpg')
  ) THEN regexp_replace(o.name, '\.jpg$', '-thumb.jpg') END,
  true
FROM storage.objects o
WHERE o.bucket_id = 'avatars'
  AND o.name ~ '^(winner|loser)-[0-9a-fA-F-]{36}\.jpg$'
ON CONFLICT (path) DO NOTHING;

-- При любом несовпадении ни удаление тестовых игр, ни импорт не сохранятся.
DO $$
DECLARE
  avatar_count bigint;
BEGIN
  IF (SELECT count(*) FROM public.sessions) <> 2 THEN
    RAISE EXCEPTION 'Ожидались 2 игры';
  END IF;
  IF (SELECT count(*) FROM public.session_players) <> 18 THEN
    RAISE EXCEPTION 'Ожидались 18 участников';
  END IF;
  IF (SELECT sum(sp.payout) FROM public.sessions s
      JOIN public.session_players sp ON sp.session_id = s.id
      WHERE s.slug = '2026-may-10') IS DISTINCT FROM 23000::bigint THEN
    RAISE EXCEPTION 'Ожидалась сумма выплат 23000 для 2026-may-10';
  END IF;
  IF (SELECT sum(sp.payout) FROM public.sessions s
      JOIN public.session_players sp ON sp.session_id = s.id
      WHERE s.slug = '2026-october-31') IS DISTINCT FROM 19000::bigint THEN
    RAISE EXCEPTION 'Ожидалась сумма выплат 19000 для 2026-october-31';
  END IF;
  IF (SELECT count(*) FROM public.game_photos) <> 412 THEN
    RAISE EXCEPTION 'Ожидались 412 фото';
  END IF;
  IF (SELECT count(*) FROM public.game_photos WHERE session_id IS NOT NULL) <> 43 THEN
    RAISE EXCEPTION 'Ожидались 43 фото, связанные с игрой';
  END IF;
  IF (SELECT count(*) FROM public.game_photos WHERE taken_at IS NOT NULL) <> 369 THEN
    RAISE EXCEPTION 'Ожидались 369 фото с временем съёмки';
  END IF;
  SELECT count(*) INTO avatar_count
  FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND name ~ '^(winner|loser)-[0-9a-fA-F-]{36}\.jpg$';
  IF avatar_count = 0 OR (SELECT count(*) FROM public.player_images) <> avatar_count THEN
    RAISE EXCEPTION 'Количество картинок игроков должно совпадать с avatars и быть больше нуля: %', avatar_count;
  END IF;
END $$;

COMMIT;

-- Сохранённый результат: 2 игры, 18 участников, выплаты 23000/19000,
-- 412 фото, из них 43 с игрой и 369 с временем; картинки игроков > 0.
SELECT
  (SELECT count(*) FROM public.sessions) AS games,
  (SELECT count(*) FROM public.session_players) AS participants,
  (SELECT sum(sp.payout) FROM public.sessions s
    JOIN public.session_players sp ON sp.session_id = s.id
    WHERE s.slug = '2026-may-10') AS may_10_payout,
  (SELECT sum(sp.payout) FROM public.sessions s
    JOIN public.session_players sp ON sp.session_id = s.id
    WHERE s.slug = '2026-october-31') AS october_31_payout,
  count(*) AS photos,
  count(*) FILTER (WHERE session_id IS NOT NULL) AS photos_with_game,
  count(*) FILTER (WHERE taken_at IS NOT NULL) AS photos_with_taken_at,
  (SELECT count(*) FROM public.player_images) AS player_images
FROM public.game_photos;
