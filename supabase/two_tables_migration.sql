-- Issue #87: two-table tournament mode foundation.
--
-- Run in Supabase SQL Editor before deploying the app code:
--   Dashboard -> your project -> SQL Editor -> paste and Run

ALTER TABLE session_players
  ADD COLUMN IF NOT EXISTS table_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS number_of_tables INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS merge_threshold INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tables_merged_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION merge_tables(p_session_id UUID)
RETURNS sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merged_session sessions;
BEGIN
  UPDATE session_players
  SET table_number = 1
  WHERE session_id = p_session_id;

  UPDATE sessions
  SET tables_merged_at = COALESCE(tables_merged_at, NOW())
  WHERE id = p_session_id
  RETURNING * INTO merged_session;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;

  RETURN merged_session;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_tables(UUID) TO anon;
