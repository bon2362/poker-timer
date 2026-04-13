import { buildStages } from '@/lib/timer';
import { saveConfig } from '@/lib/storage';
import type { TimerState, Action, SoundEvent, Stage } from '@/types/timer';

/** Compute timeLeft from anchor timestamp (wall-clock based). */
function computeTimeLeft(state: TimerState): number {
  const dur = state.stages[state.currentStage].duration;
  if (state.isPaused) {
    return dur - state.elapsedBeforePause;
  }
  const sinceResume = Math.floor((Date.now() - state.anchorTs) / 1000);
  return dur - state.elapsedBeforePause - sinceResume;
}

type RestoredStageInfo = Extract<Action, { type: 'RESTORE_STATE' }>['payload'];

function stageMatchesRestoredInfo(stage: Stage, restored: RestoredStageInfo): boolean {
  if (!restored.stageType) return true;
  if (stage.type !== restored.stageType) return false;
  if (typeof restored.stageDurationSecs === 'number' && stage.duration !== restored.stageDurationSecs) return false;

  if (stage.type === 'level') {
    if (typeof restored.levelNum === 'number' && stage.levelNum !== restored.levelNum) return false;
    if (typeof restored.sb === 'number' && stage.sb !== restored.sb) return false;
    if (typeof restored.bb === 'number' && stage.bb !== restored.bb) return false;
  }

  return true;
}

function findRestoredStageIndex(stages: Stage[], restored: RestoredStageInfo): number {
  if (!restored.stageType) return -1;
  return stages.findIndex(stage => stageMatchesRestoredInfo(stage, restored));
}

export function timerReducer(state: TimerState, action: Action): TimerState {
  switch (action.type) {
    case 'TICK': {
      if (state.isPaused) return state;

      const newTimeLeft = computeTimeLeft(state);
      const isLastStage = state.currentStage === state.stages.length - 1;

      // Overtime: last stage, timer continues negative (no sound — level is infinite)
      if (isLastStage && newTimeLeft <= 0) {
        return { ...state, timeLeft: newTimeLeft, pendingSound: null, tractorMomentActive: state.tractorMomentActive };
      }

      // 1-minute warning (robust: <= 60 transition, not exact === 61)
      let pendingSound: SoundEvent | null = null;
      let warnedOneMin = state.warnedOneMin;
      let tractorMomentActive = state.tractorMomentActive;
      if (newTimeLeft <= 60 && state.timeLeft > 60 && !state.warnedOneMin) {
        warnedOneMin = true;
        const cur = state.stages[state.currentStage];
        const nxt = state.stages[state.currentStage + 1];
        if (cur.type === 'level' && !isLastStage) {
          // Find the next level stage (may be separated by a break)
          const nextLevelStage = state.stages.slice(state.currentStage + 1).find(s => s.type === 'level');
          if (nextLevelStage?.type === 'level' && nextLevelStage.bb === 300) {
            tractorMomentActive = true;
            pendingSound = null;
          } else {
            pendingSound = nxt?.type === 'break' ? 'warnBreak' : 'warnBlinds';
          }
        } else if (cur.type === 'break') {
          pendingSound = 'warnEndBreak';
        }
      }

      // Tick sound in last 5 seconds
      if (newTimeLeft <= 5 && newTimeLeft > 0 && !pendingSound && !tractorMomentActive) {
        pendingSound = 'tick';
      }

      if (newTimeLeft <= 0) {
        if (isLastStage) {
          return { ...state, timeLeft: newTimeLeft, warnedOneMin, pendingSound: 'blindsUp', tractorMomentActive };
        }
        // Advance to next stage
        return advanceStage({ ...state, warnedOneMin, pendingSound, tractorMomentActive });
      }

      return { ...state, timeLeft: newTimeLeft, warnedOneMin, pendingSound, tractorMomentActive };
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
        tractorMomentActive: false,
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
        tractorMomentActive: false,
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
        tractorMomentActive: false,
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
        tractorMomentActive: false,
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
        tractorMomentActive: false,
      };
    }

    case 'OPEN_SETTINGS': {
      if (state.isPaused) {
        return { ...state, screen: 'settings' };
      }
      const elapsed = Math.floor((Date.now() - state.anchorTs) / 1000);
      const newElapsed = state.elapsedBeforePause + elapsed;
      const dur = state.stages[state.currentStage].duration;
      return {
        ...state,
        screen: 'settings',
        isPaused: true,
        elapsedBeforePause: newElapsed,
        timeLeft: dur - newElapsed,
      };
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
        tractorMomentActive: false,
      };
    }

    case 'SAVE_DISPLAY_CONFIG': {
      saveConfig(action.config);
      return { ...state, config: action.config };
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

    case 'TOGGLE_GAME_PANEL': {
      const newConfig = { ...state.config, showPlayers: !state.config.showPlayers };
      saveConfig(newConfig);
      return { ...state, config: newConfig };
    }

    case 'RESTORE_DISPLAY': {
      const newConfig = { ...state.config, showCombos: action.showCombos, showPlayers: action.showPlayers };
      saveConfig(newConfig);
      return { ...state, config: newConfig };
    }

    case 'RESTORE_STATE': {
      const { currentStage, anchorTs, elapsedBeforePause, isPaused, isOver, warnedOneMin, stages } = action.payload;
      const hasPersistedStages = !!stages?.length;
      const restoredStages = hasPersistedStages ? stages : state.stages;

      let restoredStage = currentStage;
      if (currentStage < 0 || currentStage >= restoredStages.length) {
        if (hasPersistedStages) return state;
        const matchingStage = findRestoredStageIndex(restoredStages, action.payload);
        if (matchingStage === -1) return state;
        restoredStage = matchingStage;
      } else if (!hasPersistedStages && !stageMatchesRestoredInfo(restoredStages[currentStage], action.payload)) {
        const matchingStage = findRestoredStageIndex(restoredStages, action.payload);
        if (matchingStage === -1) return state;
        restoredStage = matchingStage;
      }

      const restored: TimerState = {
        ...state,
        stages: restoredStages,
        currentStage: restoredStage,
        anchorTs,
        elapsedBeforePause,
        isPaused,
        isOver,
        warnedOneMin,
        pendingSound: null,
        tractorMomentActive: false,
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
    tractorMomentActive: false,
  };
}
