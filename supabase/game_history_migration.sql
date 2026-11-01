-- Инструкция: выполните этот файл в Supabase SQL Editor до выкладки кода.
-- Он только добавляет поля и таблицы, существующие данные не изменяет.
-- После выполнения проверьте результаты SELECT в конце файла.

BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at_approximate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blind_structure jsonb;

ALTER TABLE public.session_players
  ADD COLUMN IF NOT EXISTS payout integer,
  ADD COLUMN IF NOT EXISTS loser_image_id uuid,
  ADD COLUMN IF NOT EXISTS winner_image_id uuid;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.player_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id),
  kind text NOT NULL CHECK (kind IN ('loser', 'winner')),
  path text NOT NULL UNIQUE,
  thumb_path text,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_images_current_kind_idx
  ON public.player_images (player_id, kind) WHERE is_current;

CREATE TABLE IF NOT EXISTS public.game_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  path text NOT NULL UNIQUE,
  thumb_path text,
  taken_at timestamptz,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_players
  DROP CONSTRAINT IF EXISTS session_players_loser_image_id_fkey,
  DROP CONSTRAINT IF EXISTS session_players_winner_image_id_fkey,
  ADD CONSTRAINT session_players_loser_image_id_fkey
    FOREIGN KEY (loser_image_id) REFERENCES public.player_images(id),
  ADD CONSTRAINT session_players_winner_image_id_fkey
    FOREIGN KEY (winner_image_id) REFERENCES public.player_images(id);

ALTER TABLE public.player_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read player images" ON public.player_images;
CREATE POLICY "anon read player images" ON public.player_images
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon read game photos" ON public.game_photos;
CREATE POLICY "anon read game photos" ON public.game_photos
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.player_images, public.game_photos TO anon;
GRANT ALL PRIVILEGES ON public.player_images, public.game_photos TO service_role;

COMMIT;

-- Ожидаемый результат: перечислены все добавленные поля из таблиц приложения.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'sessions' AND column_name IN ('slug', 'finished_at', 'finished_at_approximate', 'blind_structure')) OR
    (table_name = 'session_players' AND column_name IN ('payout', 'loser_image_id', 'winner_image_id')) OR
    (table_name = 'players' AND column_name = 'archived_at') OR
    table_name IN ('player_images', 'game_photos')
  )
ORDER BY table_name, column_name;
