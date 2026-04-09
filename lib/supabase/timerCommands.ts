// lib/supabase/timerCommands.ts
// Subscribes to timer_commands table (written by the iOS app) and calls back with each action.

import { getClient } from '@/supabase/client';
import type { Action } from '@/types/timer';

type RemoteAction = Extract<Action['type'], 'TOGGLE_PAUSE' | 'NEXT_STAGE' | 'PREV_STAGE'>;

const ALLOWED: readonly RemoteAction[] = ['TOGGLE_PAUSE', 'NEXT_STAGE', 'PREV_STAGE'];

export function subscribeToTimerCommands(
  onCommand: (action: RemoteAction) => void
): () => void {
  const client = getClient();
  if (!client) return () => {};

  const channel = client
    .channel('timer-commands-listener')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'timer_commands' },
      async (payload) => {
        const action = payload.new.action as string;
        if ((ALLOWED as readonly string[]).includes(action)) {
          onCommand(action as RemoteAction);
          // Remove processed command so it isn't re-applied on reconnect
          await client.from('timer_commands').delete().eq('id', payload.new.id);
        }
      }
    )
    .subscribe();

  return () => { client.removeChannel(channel); };
}
