import { timerReducer } from '@/reducer/timerReducer';
import type { Action, TimerState, TimerTransition } from '@/types/timer';

let transitionSeq = 0;

/** Why the timer changed: a user action, auto-advance on time-out, or state from elsewhere. */
export function transitionCause(action: Action, prev: TimerState, next: TimerState): string {
  if (action.type === 'TICK') {
    return next.currentStage !== prev.currentStage ? 'auto_advance' : 'tick';
  }
  if (action.type === 'RESTORE_STATE') return `remote:${action.origin ?? 'unknown'}`;
  const origin = 'origin' in action && action.origin ? action.origin : 'user';
  return `${origin}:${action.type}`;
}

function timerChanged(prev: TimerState, next: TimerState): boolean {
  return (
    prev.currentStage !== next.currentStage ||
    prev.isPaused !== next.isPaused ||
    prev.isOver !== next.isOver ||
    prev.anchorTs !== next.anchorTs ||
    prev.elapsedBeforePause !== next.elapsedBeforePause
  );
}

/**
 * timerReducer + a record of the last meaningful change (stage / pause / anchor),
 * so the provider can log what caused it.
 */
export function trackedTimerReducer(state: TimerState, action: Action): TimerState {
  const next = timerReducer(state, action);
  if (next === state || !timerChanged(state, next)) return next;
  const lastTransition: TimerTransition = {
    seq: ++transitionSeq,
    cause: transitionCause(action, state, next),
    fromStage: state.currentStage,
    toStage: next.currentStage,
    wasPaused: state.isPaused,
    isPaused: next.isPaused,
    prevAnchorTs: state.anchorTs,
    anchorTs: next.anchorTs,
    elapsedBeforePause: next.elapsedBeforePause,
    timeLeftBefore: state.timeLeft,
  };
  return { ...next, lastTransition };
}
