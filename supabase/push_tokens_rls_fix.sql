-- Security fix: revoke broad anon access to push_tokens
--
-- The original migration granted FOR ALL TO anon (SELECT + INSERT + UPDATE + DELETE).
-- Only the upsert_push_token SECURITY DEFINER RPC needs table access — anon doesn't.
-- The Edge Function reads tokens via service role key, so no anon SELECT is needed.
--
-- Run in Supabase SQL Editor:
--   Dashboard → your project → SQL Editor → paste and Run

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens' AND policyname = 'allow_anon_upsert'
  ) THEN
    DROP POLICY allow_anon_upsert ON push_tokens;
  END IF;
END $$;

-- No replacement policy needed:
-- upsert_push_token() runs as SECURITY DEFINER (table owner), bypassing RLS.
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY, also bypassing RLS.
