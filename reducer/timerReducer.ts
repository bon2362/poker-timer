import { buildStages } from '@/lib/timer';
import { saveConfig } from '@/lib/storage';
import type { TimerState, Action, SoundEvent } from '@/types/timer';

export function timerReducer(state: TimerState, action: Action): TimerState {
  switch (action.type) {
    case 'TICK': {
      if (state.isPaused) return state;

      const isLastStage = state.currentStage === state.stages.length - 1;

      // Overtime: last stage, timer continues negative
      if (isLastStage && state.timeLeft <= 0) {
        return { ...state, timeLeft: state.timeLeft - 1, pendingSound: null };
      }

      // 1-minute warning
      let pendingSound: SoundEvent | null = null;
      let warnedOneMin = state.warnedOneMin;
      if (state.timeLeft === 61 && !state.warnedOneMin) {
        warnedOneMin = true;
        const cur = state.stages[state.currentStage];
        const nxt = state.stages[state.currentStage + 1];
        if (cur.type === 'level') {
          pendingSound = nxt?.type === 'break' ? 'warnBreak' : 'warnBlinds';
        } else if (cur.type === 'break') {
          pendingSound = 'warnEndBreak';
        }
      }

      const newTimeLeft = state.timeLeft - 1;

      // Tick sound in last 5 seconds
      if (newTimeLeft <= 5 && newTimeLeft > 0 && !pendingSound) {
        pendingSound = 'tick';
      }

      if (newTimeLeft <= 0) {
        if (isLastStage) {
          // First tick into overtime: play blindsUp sound
          return {
            ...state,
            timeLeft: newTimeLeft,
            warnedOneMin,
            pendingSound: 'blindsUp',
          };
        }
        // Advance to next stage
        return advanceStage({ ...state, warnedOneMin, pendingSound });
      }

      return { ...state, timeLeft: newTimeLeft, warnedOneMin, pendingSound };
    }

    case 'TOGGLE_PAUSE': {
      if (state.isOver) return state;
      return { ...state, isPaused: !state.isPaused };
    }

    case 'NEXT_STAGE': {
      if (state.currentStage >= state.stages.length - 1) return state;
      const next = state.currentStage + 1;
      return {
        ...state,
        currentStage: next,
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
        timeLeft: state.stages[prev].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'RESET_STAGE': {
      return {
        ...state,
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
        timeLeft: state.stages[last].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'RESTART': {
      return {
        ...state,
        currentStage: 0,
        timeLeft: state.stages[0].duration,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        pendingSound: null,
        screen: 'timer',
      };
    }

    case 'OPEN_SETTINGS': {
      return { ...state, screen: 'settings', isPaused: true };
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
      return { ...state, timeLeft: 65, warnedOneMin: false, pendingSound: null };
    }

    case 'TOGGLE_COMBOS': {
      const newConfig = { ...state.config, showCombos: !state.config.showCombos };
      saveConfig(newConfig);
      return { ...state, config: newConfig };
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
    timeLeft: nextStage.duration,
    warnedOneMin: false,
    pendingSound,
  };
}
