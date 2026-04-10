// lib/supabase/timerState.ts
import { getClient } from '@/supabase/client';
import type { Stage } from '@/types/timer';

export type PersistedTimerState = {
  currentStage: number;
  anchorTs: number;
  elapsedBeforePause: number;
  isPaused: boolean;
  isOver: boolean;
  warnedOneMin: boolean;
  // iOS Live Activity fields (added v4.14)
  stageType: Stage['type']; // "level" | "break"
  levelNum: number;         // 1-based; 0 for breaks
  sb: number;
  bb: number;
  stageDurationSecs: number;
  // Full stage list for backend RPC navigation (added v4.15)
  stages?: Stage[];
  updatedAt?: string;
};

export function isPersistedTimerStateStaleForSession(
  timerUpdatedAt: string | undefined,
  sessionCreatedAt: string | undefined
): boolean {
  if (!timerUpdatedAt || !sessionCreatedAt) return false;

  const timerTs = Date.parse(timerUpdatedAt);
  const sessionTs = Date.parse(sessionCreatedAt);
  if (!Number.isFinite(timerTs) || !Number.isFinite(sessionTs)) return false;

  return timerTs < sessionTs;
}

export function parsePersistedStages(value: unknown): Stage[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const stages: Stage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return undefined;
    const stage = item as Record<string, unknown>;
    const duration = Number(stage.duration);
    if (!Number.isFinite(duration) || duration <= 0) return undefined;

    if (stage.type === 'break') {
      stages.push({ type: 'break', duration });
      continue;
    }

    if (stage.type === 'level') {
      const levelNum = Number(stage.levelNum);
      const sb = Number(stage.sb);
      const bb = Number(stage.bb);
      if (!Number.isFinite(levelNum) || !Number.isFinite(sb) || !Number.isFinite(bb)) return undefined;
      stages.push({ type: 'level', levelNum, sb, bb, duration });
      continue;
    }

    return undefined;
  }

  return stages.length > 0 ? stages : undefined;
}

export async function fetchTimerState(): Promise<PersistedTimerState | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from('timer_state')
    .select('current_stage, anchor_ts, elapsed_before_pause, is_paused, is_over, warned_one_min, stage_type, level_num, sb, bb, stage_duration_secs, stages_json, updated_at')
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
    stageType: data.stage_type === 'break' ? 'break' : 'level',
    levelNum: (data.level_num as number) ?? 1,
    sb: (data.sb as number) ?? 0,
    bb: (data.bb as number) ?? 0,
    stageDurationSecs: (data.stage_duration_secs as number) ?? 1200,
    stages: parsePersistedStages(data.stages_json),
    updatedAt: data.updated_at as string | undefined,
  };
}

export async function saveTimerState(state: PersistedTimerState): Promise<void> {
  const client = getClient();
  if (!client) return;

  const row = {
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
    stages_json: state.stages ?? null,
    source: 'web',
    updated_at: new Date().toISOString(),
  };

  const { error: rpcError } = await client.rpc('set_timer_state', {
    current_stage_arg: row.current_stage,
    anchor_ts_arg: row.anchor_ts,
    elapsed_before_pause_arg: row.elapsed_before_pause,
    is_paused_arg: row.is_paused,
    is_over_arg: row.is_over,
    warned_one_min_arg: row.warned_one_min,
    stage_type_arg: row.stage_type,
    level_num_arg: row.level_num,
    sb_arg: row.sb,
    bb_arg: row.bb,
    stage_duration_secs_arg: row.stage_duration_secs,
    stages_json_arg: row.stages_json,
  });

  if (!rpcError) return;

  const { data, error } = await client
    .from('timer_state')
    .upsert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('saveTimerState: failed to persist timer_state', error.message);
    return;
  }

  if (!data) {
    console.warn('saveTimerState: timer_state write returned no row; check RLS or set_timer_state RPC');
  }
}
