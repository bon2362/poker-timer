import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

export function getTimerChannel(sessionId: string): RealtimeChannel {
  const client = getClient();
  if (!client) {
    const noop = {} as RealtimeChannel;
    Object.assign(noop, {
      on: () => noop,
      subscribe: () => noop,
      unsubscribe: () => Promise.resolve('ok' as const),
      send: () => Promise.resolve('ok' as const),
    });
    return noop;
  }
  return client.channel(`timer:${sessionId}`, {
    config: { broadcast: { self: false } },
  });
}
