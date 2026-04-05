import { timerReducer } from '@/reducer/timerReducer';
import { buildStages } from '@/lib/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import type { TimerState } from '@/types/timer';

beforeEach(() => {
  localStorage.clear();
});

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  const config = DEFAULT_CONFIG;
  const stages = buildStages(config);
  return {
    stages,
    currentStage: 0,
    timeLeft: stages[0].duration,
    isPaused: true,
    isOver: false,
    warnedOneMin: false,
    config,
    screen: 'timer',
    pendingSound: null,
    ...overrides,
  };
}

describe('TICK', () => {
  test('does not decrement timeLeft when paused', () => {
    const state = makeState({ isPaused: true, timeLeft: 1200 });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(1200);
  });

  test('decrements timeLeft when running', () => {
    const state = makeState({ isPaused: false, timeLeft: 100 });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(99);
  });

  test('sets pendingSound and warnedOneMin at 61 seconds on level stage', () => {
    const state = makeState({ isPaused: false, timeLeft: 61, warnedOneMin: false });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.warnedOneMin).toBe(true);
    expect(next.pendingSound).not.toBeNull();
  });

  test('does not set pendingSound again if warnedOneMin already true', () => {
    const state = makeState({ isPaused: false, timeLeft: 61, warnedOneMin: true });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBeNull();
  });

  test('advances to next stage when timeLeft reaches 0 (non-last stage)', () => {
    const state = makeState({ isPaused: false, timeLeft: 1, currentStage: 0 });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.currentStage).toBe(1);
    expect(next.timeLeft).toBe(next.stages[1].duration);
  });

  test('goes into overtime on last stage (timeLeft continues negative)', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const lastIdx = stages.length - 1;
    const state = makeState({ isPaused: false, timeLeft: 0, currentStage: lastIdx });
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

describe('CLEAR_SOUND', () => {
  test('clears pendingSound', () => {
    const state = makeState({ pendingSound: 'blindsUp' });
    const next = timerReducer(state, { type: 'CLEAR_SOUND' });
    expect(next.pendingSound).toBeNull();
  });
});
