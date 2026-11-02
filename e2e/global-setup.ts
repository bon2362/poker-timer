import { createClient } from '@supabase/supabase-js';

const PROD_PROJECT_REF = 'dbayngkhribcllxdoozo';

// Child tables first, so foreign keys don't block the deletes.
const TABLES = [
  'session_players',
  'game_photos',
  'player_images',
  'sessions',
  'players',
  'timer_commands',
  'push_tokens',
  'timer_state',
  'minute_timer_state',
  'app_config',
];

// Empties the test Supabase project before a run, so every run starts from Round 1 with no game.
// Without the test project's keys the site runs with Supabase off and there is nothing to reset.
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.PLAYWRIGHT_BASE_URL || !url || !serviceKey) return;
  if (url.includes(PROD_PROJECT_REF)) throw new Error('E2E must never reset the production Supabase project');

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  for (const table of TABLES) {
    const { error } = await client.from(table).delete().not('id', 'is', null);
    if (error) throw new Error(`Failed to reset ${table}: ${error.message}`);
  }
}
