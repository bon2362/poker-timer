// lib/supabase/timerState.ts
import { getClient } from '@/supabase/client';

export type PersistedTimerState = {
  currentStage: number;
  anchorTs: number;
  elapsedBeforePause: number;
  isPaused: boolean;
  isOver: boolean;
  warnedOneMin: boolean;
};

export async function fetchTimerState(): Promise<PersistedTimerState | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from('timer_state')
    .select('current_stage, anchor_ts, elapsed_before_pause, is_paused, is_over, warned_one_min')
    .eq('id', 'main')
    .maybeSingle();
  if (error || !data) return null;
  return {
    currentStage: data.current_stage as number,
    anchorTs: data.anchor_ts as number,
    elapsedBeforePause: data.elapsed_before_pause as number,
    isPaused: data.is_paused as boolean,
    isOver: data.is_over as boolean,
    warnedOneMin: data.warned_one_min as boolean,
  };
}

export async function saveTimerState(state: PersistedTimerState): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.from('timer_state').upsert({
    id: 'main',
    current_stage: state.currentStage,
    anchor_ts: state.anchorTs,
    elapsed_before_pause: state.elapsedBeforePause,
    is_paused: state.isPaused,
    is_over: state.isOver,
    warned_one_min: state.warnedOneMin,
    updated_at: new Date().toISOString(),
  });
}
