-- Settings that `supabase db dump --schema public` does not include.
-- Apply after schema.sql when building a new Supabase project from scratch.
-- Taken from production on 2026-11-21.

-- Realtime: tables whose changes are pushed to all devices.
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.app_config,
  public.minute_timer_state,
  public.session_players,
  public.sessions,
  public.timer_commands,
  public.timer_state;

-- Storage: public buckets for player photos and the slideshow.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('slideshow', 'slideshow', true, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public avatar read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

CREATE POLICY "public slideshow read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'slideshow');
