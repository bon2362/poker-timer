import { buildStages } from '@/lib/timer';
import { loadConfig, DEFAULT_CONFIG } from '@/lib/storage';
import type { TimerState } from '@/types/timer';

export function createInitialState(): TimerState {
  const config = typeof window !== 'undefined' ? loadConfig() : structuredClone(DEFAULT_CONFIG);
  const stages = buildStages(config);
  return {
    stages,
    currentStage: 0,
    timeLeft: stages[0].duration,
    anchorTs: Date.now(),
    elapsedBeforePause: 0,
    isPaused: true,
    isOver: false,
    warnedOneMin: false,
    config,
    screen: 'timer',
    pendingSound: null,
  };
}
