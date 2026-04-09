// lib/supabase/timerState.ts
import { getClient } from '@/supabase/client';

export type PersistedTimerState = {
  currentStage: number;
  anchorTs: number;
  elapsedBeforePause: number;
  isPaused: boolean;
  isOver: boolean;
  warnedOneMin: boolean;
  // iOS Live Activity fields (added v4.14)
  stageType: string;        // "level" | "break"
  levelNum: number;         // 1-based; 0 for breaks
  sb: number;
  bb: number;
  stageDurationSecs: number;
};

export async function fetchTimerState(): Promise<PersistedTimerState | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from('timer_state')
    .select('current_stage, anchor_ts, elapsed_before_pause, is_paused, is_over, warned_one_min, stage_type, level_num, sb, bb, stage_duration_secs')
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
    stageType: (data.stage_type as string) ?? 'level',
    levelNum: (data.level_num as number) ?? 1,
    sb: (data.sb as number) ?? 0,
    bb: (data.bb as number) ?? 0,
    stageDurationSecs: (data.stage_duration_secs as number) ?? 1200,
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
    stage_type: state.stageType,
    level_num: state.levelNum,
    sb: state.sb,
    bb: state.bb,
    stage_duration_secs: state.stageDurationSecs,
    updated_at: new Date().toISOString(),
  });
}
