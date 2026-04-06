import { buildStages } from '@/lib/timer';
import { saveConfig } from '@/lib/storage';
import type { TimerState, Action, SoundEvent } from '@/types/timer';

/** Compute timeLeft from anchor timestamp (wall-clock based). */
function computeTimeLeft(state: TimerState): number {
  const dur = state.stages[state.currentStage].duration;
  if (state.isPaused) {
    return dur - state.elapsedBeforePause;
  }
  const sinceResume = Math.floor((Date.now() - state.anchorTs) / 1000);
  return dur - state.elapsedBeforePause - sinceResume;
}

export function timerReducer(state: TimerState, action: Action): TimerState {
  switch (action.type) {
    case 'TICK': {
      if (state.isPaused) return state;

      const newTimeLeft = computeTimeLeft(state);
      const isLastStage = state.currentStage === state.stages.length - 1;

      // Overtime: last stage, timer continues negative
      if (isLastStage && newTimeLeft <= 0) {
        // First entry into overtime — play blindsUp
        const pendingSound: SoundEvent | null =
          state.timeLeft > 0 && newTimeLeft <= 0 ? 'blindsUp' : null;
        return { ...state, timeLeft: newTimeLeft, pendingSound };
      }

      // 1-minute warning (robust: <= 60 transition, not exact === 61)
      let pendingSound: SoundEvent | null = null;
      let warnedOneMin = state.warnedOneMin;
      if (newTimeLeft <= 60 && state.timeLeft > 60 && !state.warnedOneMin) {
        warnedOneMin = true;
        const cur = state.stages[state.currentStage];
        const nxt = state.stages[state.currentStage + 1];
        if (cur.type === 'level') {
          pendingSound = nxt?.type === 'break' ? 'warnBreak' : 'warnBlinds';
        } else if (cur.type === 'break') {
          pendingSound = 'warnEndBreak';
        }
      }

      // Tick sound in last 5 seconds
      if (newTimeLeft <= 5 && newTimeLeft > 0 && !pendingSound) {
        pendingSound = 'tick';
      }

      if (newTimeLeft <= 0) {
        if (isLastStage) {
          return { ...state, timeLeft: newTimeLeft, warnedOneMin, pendingSound: 'blindsUp' };
        }
        // Advance to next stage
        return advanceStage({ ...state, warnedOneMin, pendingSound });
      }

      return { ...state, timeLeft: newTimeLeft, warnedOneMin, pendingSound };
    }

    case 'TOGGLE_PAUSE': {
      if (state.isOver) return state;
      if (state.isPaused) {
        // Resume — set fresh anchor
        return {
          ...state,
          isPaused: false,
          anchorTs: Date.now(),
          timeLeft: computeTimeLeft(state),
        };
      } else {
        // Pause — accumulate elapsed time
        const elapsed = Math.floor((Date.now() - state.anchorTs) / 1000);
        const newElapsed = state.elapsedBeforePause + elapsed;
        const dur = state.stages[state.currentStage].duration;
        return {
          ...state,
          isPaused: true,
          elapsedBeforePause: newElapsed,
          timeLeft: dur - newElapsed,
        };
      }
    }

    case 'NEXT_STAGE': {
      if (state.currentStage >= state.stages.length - 1) return state;
      const next = state.currentStage + 1;
      return {
        ...state,
        currentStage: next,
        anchorTs: Date.now(),
        elapsedBeforePause: 0,
        timeLeft: state.stages[next].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'PREV_STAGE': {
      if (state.currentStage <= 0) return state;
      const prev = state.currentStage - 1;
      return {
        ...state,
        currentStage: prev,
        anchorTs: Date.now(),
        elapsedBeforePause: 0,
        timeLeft: state.stages[prev].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'RESET_STAGE': {
      return {
        ...state,
        anchorTs: Date.now(),
        elapsedBeforePause: 0,
        timeLeft: state.stages[state.currentStage].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'GO_TO_LAST': {
      const last = state.stages.length - 1;
      return {
        ...state,
        currentStage: last,
        anchorTs: Date.now(),
        elapsedBeforePause: 0,
        timeLeft: state.stages[last].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'RESTART': {
      return {
        ...state,
        currentStage: 0,
        anchorTs: Date.now(),
        elapsedBeforePause: 0,
        timeLeft: state.stages[0].duration,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        pendingSound: null,
        screen: 'timer',
      };
    }

    case 'OPEN_SETTINGS': {
      return { ...state, screen: 'settings' };
    }

    case 'CLOSE_SETTINGS': {
      return { ...state, screen: 'timer' };
    }

    case 'SAVE_SETTINGS': {
      saveConfig(action.config);
      const stages = buildStages(action.config);
      return {
        ...state,
        config: action.config,
        stages,
        currentStage: 0,
        anchorTs: Date.now(),
        elapsedBeforePause: 0,
        timeLeft: stages[0].duration,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        pendingSound: null,
        screen: 'timer',
      };
    }

    case 'CLEAR_SOUND': {
      return { ...state, pendingSound: null };
    }

    case 'JUMP_TO_END': {
      const dur = state.stages[state.currentStage].duration;
      return {
        ...state,
        anchorTs: Date.now(),
        elapsedBeforePause: dur - 65,
        timeLeft: 65,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'TOGGLE_COMBOS': {
      const newConfig = { ...state.config, showCombos: !state.config.showCombos };
      saveConfig(newConfig);
      return { ...state, config: newConfig };
    }

    case 'RESTORE_STATE': {
      const { currentStage, anchorTs, elapsedBeforePause, isPaused, isOver, warnedOneMin } = action.payload;
      // Guard: ignore if stage index out of range (stale DB from different config)
      if (currentStage >= state.stages.length) return state;
      const restored: TimerState = {
        ...state,
        currentStage,
        anchorTs,
        elapsedBeforePause,
        isPaused,
        isOver,
        warnedOneMin,
        pendingSound: null,
      };
      return { ...restored, timeLeft: computeTimeLeft(restored) };
    }

    default:
      return state;
  }
}

function advanceStage(state: TimerState): TimerState {
  const nextIdx = state.currentStage + 1;
  const wasBreak = state.stages[state.currentStage].type === 'break';
  const nextStage = state.stages[nextIdx];

  let pendingSound: SoundEvent;
  if (nextStage.type === 'break') {
    pendingSound = 'breakStart';
  } else if (wasBreak) {
    pendingSound = 'breakOver';
  } else {
    pendingSound = 'blindsUp';
  }

  return {
    ...state,
    currentStage: nextIdx,
    anchorTs: Date.now(),
    elapsedBeforePause: 0,
    timeLeft: nextStage.duration,
    warnedOneMin: false,
    pendingSound,
  };
}
