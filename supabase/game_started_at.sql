-- Инструкция: выполните этот файл перед выкладкой версии 6.6.
-- Файл добавляет время старта игры. Новые игры записывают его при первом запуске таймера.
-- У завершённых игр старт раньше не записывался, поэтому берётся время создания игры.
BEGIN;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS started_at timestamptz NULL;

UPDATE public.sessions SET started_at = created_at WHERE status = 'finished' AND started_at IS NULL;

COMMIT;

-- Ожидается: у каждой завершённой игры started_at совпадает с created_at, duration равна времени игры.
SELECT slug, started_at, finished_at, finished_at - started_at AS duration FROM public.sessions ORDER BY created_at;
