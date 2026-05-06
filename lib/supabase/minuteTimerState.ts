import { getClient } from '@/supabase/client';

export type PersistedMinuteTimerState = {
  active: boolean;
  playerName: string;
  playerId: string;
  endTs: number;
};

function toMinuteTimerState(row: Record<string, unknown>): PersistedMinuteTimerState {
  return {
    active: row.active as boolean,
    playerName: (row.player_name as string | null) ?? '',
    playerId: (row.player_id as string | null) ?? '',
    endTs: Number(row.end_ts ?? 0),
  };
}

export async function fetchMinuteTimerState(): Promise<PersistedMinuteTimerState | null> {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('minute_timer_state')
    .select('active, player_name, player_id, end_ts')
    .eq('id', 'main')
    .maybeSingle();

  if (error || !data) return null;
  return toMinuteTimerState(data);
}

export async function saveMinuteTimerState(state: PersistedMinuteTimerState): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { error: rpcError } = await client.rpc('set_minute_timer_state', {
    active_arg: state.active,
    player_name_arg: state.playerName,
    player_id_arg: state.playerId,
    end_ts_arg: state.endTs,
  });

  if (!rpcError) return;

  const { data, error } = await client
    .from('minute_timer_state')
    .upsert({
      id: 'main',
      active: state.active,
      player_name: state.playerName,
      player_id: state.playerId,
      end_ts: state.endTs,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('saveMinuteTimerState: failed to persist minute_timer_state', error.message);
    return;
  }

  if (!data) {
    console.warn('saveMinuteTimerState: minute_timer_state write returned no row; check RLS or set_minute_timer_state RPC');
  }
}
