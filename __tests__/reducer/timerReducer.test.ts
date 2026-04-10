import { timerReducer } from '@/reducer/timerReducer';
import { buildStages } from '@/lib/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import type { TimerState } from '@/types/timer';

const FIXED_NOW = 1_700_000_000_000;

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  const config = DEFAULT_CONFIG;
  const stages = buildStages(config);
  return {
    stages,
    currentStage: 0,
    timeLeft: stages[0].duration,
    anchorTs: FIXED_NOW,
    elapsedBeforePause: 0,
    isPaused: true,
    isOver: false,
    warnedOneMin: false,
    config,
    screen: 'timer',
    pendingSound: null,
    ...overrides,
  };
}

/**
 * Build a running state where computeTimeLeft() returns exactly `timeLeft`
 * when Date.now() === FIXED_NOW (sinceResume = 0).
 */
function makeRunningState(timeLeft: number, overrides: Partial<TimerState> = {}): TimerState {
  const config = DEFAULT_CONFIG;
  const stages = buildStages(config);
  const stageIdx = (overrides.currentStage as number) ?? 0;
  const dur = stages[stageIdx].duration;
  return makeState({
    isPaused: false,
    anchorTs: FIXED_NOW,
    elapsedBeforePause: dur - timeLeft,
    timeLeft,
    ...overrides,
  });
}

describe('TICK', () => {
  test('does not decrement timeLeft when paused', () => {
    const state = makeState({ isPaused: true, timeLeft: 1200 });
    jest.setSystemTime(FIXED_NOW + 5000); // time passes but timer is paused
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(1200);
  });

  test('decrements timeLeft when 1 second elapses while running', () => {
    const state = makeRunningState(100);
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(99);
  });

  test('sets pendingSound and warnedOneMin when timeLeft crosses 60s boundary', () => {
    const state = makeRunningState(61);
    jest.setSystemTime(FIXED_NOW + 1000); // advances to 60s — crosses the warning boundary
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.warnedOneMin).toBe(true);
    expect(next.pendingSound).not.toBeNull();
  });

  test('does not set pendingSound again if warnedOneMin already true', () => {
    const state = makeRunningState(61, { warnedOneMin: true });
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBeNull();
  });

  test('advances to next stage when timeLeft reaches 0 (non-last stage)', () => {
    const state = makeRunningState(1, { currentStage: 0 });
    jest.setSystemTime(FIXED_NOW + 1000); // elapses to 0
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.currentStage).toBe(1);
    expect(next.timeLeft).toBe(next.stages[1].duration);
  });

  test('goes into overtime on last stage (timeLeft continues negative)', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const lastIdx = stages.length - 1;
    const state = makeRunningState(0, { currentStage: lastIdx });
    jest.setSystemTime(FIXED_NOW + 1000); // elapses to -1
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(-1);
    expect(next.isOver).toBe(false);
    expect(next.currentStage).toBe(lastIdx);
  });
});

describe('TOGGLE_PAUSE', () => {
  test('flips isPaused from true to false', () => {
    const state = makeState({ isPaused: true });
    const next = timerReducer(state, { type: 'TOGGLE_PAUSE' });
    expect(next.isPaused).toBe(false);
  });

  test('flips isPaused from false to true', () => {
    const state = makeState({ isPaused: false });
    const next = timerReducer(state, { type: 'TOGGLE_PAUSE' });
    expect(next.isPaused).toBe(true);
  });

  test('is no-op when isOver', () => {
    const state = makeState({ isOver: true, isPaused: true });
    const next = timerReducer(state, { type: 'TOGGLE_PAUSE' });
    expect(next.isPaused).toBe(true);
  });
});

describe('NEXT_STAGE', () => {
  test('increments currentStage and resets timeLeft', () => {
    const state = makeState({ currentStage: 0, timeLeft: 500 });
    const next = timerReducer(state, { type: 'NEXT_STAGE' });
    expect(next.currentStage).toBe(1);
    expect(next.timeLeft).toBe(next.stages[1].duration);
    expect(next.warnedOneMin).toBe(false);
  });

  test('does not exceed last stage', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const state = makeState({ currentStage: stages.length - 1 });
    const next = timerReducer(state, { type: 'NEXT_STAGE' });
    expect(next.currentStage).toBe(stages.length - 1);
  });
});

describe('PREV_STAGE', () => {
  test('decrements currentStage', () => {
    const state = makeState({ currentStage: 2 });
    const next = timerReducer(state, { type: 'PREV_STAGE' });
    expect(next.currentStage).toBe(1);
  });

  test('is no-op at stage 0', () => {
    const state = makeState({ currentStage: 0 });
    const next = timerReducer(state, { type: 'PREV_STAGE' });
    expect(next.currentStage).toBe(0);
  });
});

describe('RESET_STAGE', () => {
  test('resets timeLeft to current stage duration', () => {
    const state = makeState({ currentStage: 0, timeLeft: 100 });
    const next = timerReducer(state, { type: 'RESET_STAGE' });
    expect(next.timeLeft).toBe(state.stages[0].duration);
    expect(next.warnedOneMin).toBe(false);
  });
});

describe('GO_TO_LAST', () => {
  test('goes to the last stage', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const state = makeState({ currentStage: 0 });
    const next = timerReducer(state, { type: 'GO_TO_LAST' });
    expect(next.currentStage).toBe(stages.length - 1);
  });
});

describe('RESTART', () => {
  test('resets to initial state', () => {
    const state = makeState({ currentStage: 5, timeLeft: 42, isPaused: false, isOver: true });
    const next = timerReducer(state, { type: 'RESTART' });
    expect(next.currentStage).toBe(0);
    expect(next.timeLeft).toBe(next.stages[0].duration);
    expect(next.isPaused).toBe(true);
    expect(next.isOver).toBe(false);
  });
});

describe('OPEN_SETTINGS / CLOSE_SETTINGS', () => {
  test('OPEN_SETTINGS sets screen to settings and pauses', () => {
    const state = makeState({ screen: 'timer', isPaused: false });
    const next = timerReducer(state, { type: 'OPEN_SETTINGS' });
    expect(next.screen).toBe('settings');
    expect(next.isPaused).toBe(true);
  });

  test('CLOSE_SETTINGS sets screen to timer', () => {
    const state = makeState({ screen: 'settings' });
    const next = timerReducer(state, { type: 'CLOSE_SETTINGS' });
    expect(next.screen).toBe('timer');
  });
});

describe('SAVE_SETTINGS', () => {
  test('updates config and rebuilds stages', () => {
    const state = makeState();
    const newConfig = { ...DEFAULT_CONFIG, levelDuration: 15 };
    const next = timerReducer(state, { type: 'SAVE_SETTINGS', config: newConfig });
    expect(next.config.levelDuration).toBe(15);
    expect(next.stages[0].duration).toBe(900);
    expect(next.currentStage).toBe(0);
    expect(next.screen).toBe('timer');
  });
});

describe('RESTORE_STATE', () => {
  test('uses persisted stages so a saved level index is not restored as a local break', () => {
    const localState = makeState();
    const persistedConfig = { ...DEFAULT_CONFIG, breakEvery: 4 };
    const persistedStages = buildStages(persistedConfig);

    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 2,
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'level',
        levelNum: 3,
        sb: 30,
        bb: 60,
        stageDurationSecs: persistedStages[2].duration,
        stages: persistedStages,
      },
    });

    expect(next.stages).toBe(persistedStages);
    expect(next.currentStage).toBe(2);
    expect(next.stages[next.currentStage]).toMatchObject({ type: 'level', levelNum: 3, sb: 30, bb: 60 });
  });

  test('falls back to stage metadata when persisted stages are unavailable', () => {
    const localState = makeState();
    expect(localState.stages[2].type).toBe('break');

    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 2,
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'level',
        levelNum: 3,
        sb: 30,
        bb: 60,
        stageDurationSecs: 1200,
      },
    });

    expect(next.currentStage).toBe(3);
    expect(next.stages[next.currentStage]).toMatchObject({ type: 'level', levelNum: 3, sb: 30, bb: 60 });
  });
});

describe('CLEAR_SOUND', () => {
  test('clears pendingSound', () => {
    const state = makeState({ pendingSound: 'blindsUp' });
    const next = timerReducer(state, { type: 'CLEAR_SOUND' });
    expect(next.pendingSound).toBeNull();
  });
});
