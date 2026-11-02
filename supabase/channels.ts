import type { RealtimeChannel } from '@supabase/supabase-js';
import { getClient } from '@/supabase/client';

const pendingRemovals = new Map<string, Promise<unknown>>();

// Supabase hands out the same channel object for a name until its removal finishes, and that
// object cannot subscribe twice. When a page mounts while the previous one is still leaving
// (switching admin tabs), wait for the removal before subscribing to a fresh channel.
export function subscribeChannel(
  topic: string,
  create: () => RealtimeChannel,
  onReady?: (channel: RealtimeChannel) => void,
): () => void {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  const start = () => {
    if (cancelled) return;
    channel = create();
    channel.subscribe();
    onReady?.(channel);
  };

  const pending = pendingRemovals.get(topic);
  if (pending) void pending.then(start);
  else start();

  return () => {
    cancelled = true;
    const client = getClient();
    if (!channel || !client) return;
    const removal = Promise.resolve(client.removeChannel(channel)).catch(() => {});
    pendingRemovals.set(topic, removal);
    void removal.then(() => {
      if (pendingRemovals.get(topic) === removal) pendingRemovals.delete(topic);
    });
  };
}
