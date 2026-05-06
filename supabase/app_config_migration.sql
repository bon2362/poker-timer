-- Durable application config for desktop clients.
--
-- Run in Supabase SQL Editor:
--   Dashboard -> your project -> SQL Editor -> paste and Run

CREATE TABLE IF NOT EXISTS app_config (
  id          TEXT        PRIMARY KEY DEFAULT 'main',
  config_json JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_config' AND policyname = 'allow_anon_select_app_config'
  ) THEN
    CREATE POLICY allow_anon_select_app_config ON app_config
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_app_config(config_json_arg JSONB)
RETURNS app_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION set_app_config(JSONB) TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_config'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE app_config';
  END IF;
END $$;
