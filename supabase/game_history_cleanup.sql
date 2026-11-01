-- Инструкция: выполняйте только с подтверждения владельца, после проверки запрета на запись.
-- Файл удаляет резервные копии, сделанные перед переносом истории игр. Восстановить их будет нельзя.
BEGIN;
DROP TABLE IF EXISTS public.backup_20261101_session_players;
DROP TABLE IF EXISTS public.backup_20261101_sessions;
COMMIT;

-- Ожидается: 0 строк.
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'backup_20261101_%';
