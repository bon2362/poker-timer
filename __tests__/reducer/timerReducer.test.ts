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
    tractorMomentActive: false,
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

describe('PAUSE_TIMER / RESUME_TIMER', () => {
  test('PAUSE_TIMER pauses a running timer without toggling back on repeated dispatch', () => {
    const state = makeState({ isPaused: false, anchorTs: FIXED_NOW, timeLeft: 1200 });
    jest.setSystemTime(FIXED_NOW + 5000);

    const paused = timerReducer(state, { type: 'PAUSE_TIMER' });
    const pausedAgain = timerReducer(paused, { type: 'PAUSE_TIMER' });

    expect(paused.isPaused).toBe(true);
    expect(pausedAgain.isPaused).toBe(true);
    expect(pausedAgain.timeLeft).toBe(paused.timeLeft);
  });

  test('RESUME_TIMER resumes a paused timer without toggling back on repeated dispatch', () => {
    const state = makeState({ isPaused: true, timeLeft: 1200 });

    const running = timerReducer(state, { type: 'RESUME_TIMER' });
    const runningAgain = timerReducer(running, { type: 'RESUME_TIMER' });

    expect(running.isPaused).toBe(false);
    expect(runningAgain.isPaused).toBe(false);
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

describe('TICK — sound events', () => {
  test('warnBreak: level stage with next=break crossing 60s boundary', () => {
    // stages[0]=level1, stages[1]=level2, stages[2]=break
    // We need a level stage where next stage is a break
    // With breakEvery=2: stages[1] (level2) is followed by stages[2] (break)
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[1].type).toBe('level');
    expect(stages[2].type).toBe('break');

    const state = makeRunningState(61, { currentStage: 1 });
    jest.setSystemTime(FIXED_NOW + 1000); // timeLeft drops to 60, crossing the boundary
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBe('warnBreak');
    expect(next.warnedOneMin).toBe(true);
  });

  test('warnBlinds: level stage with next=level crossing 60s boundary', () => {
    // stages[0]=level1, stages[1]=level2 — next is stages[1] which is level
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[0].type).toBe('level');
    expect(stages[1].type).toBe('level');

    const state = makeRunningState(61, { currentStage: 0 });
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBe('warnBlinds');
    expect(next.warnedOneMin).toBe(true);
  });

  test('warnEndBreak: break stage crossing 60s boundary', () => {
    // stages[2] is a break
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[2].type).toBe('break');

    const state = makeRunningState(61, { currentStage: 2 });
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBe('warnEndBreak');
    expect(next.warnedOneMin).toBe(true);
  });

  test('tick sound: timeLeft in 1-5 second range', () => {
    const state = makeRunningState(3);
    // No time advance — sinceResume=0, so newTimeLeft=3, which is in [1,5]
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBe('tick');
  });

  test('blindsUp at last stage when timeLeft is exactly 0 (not yet negative)', () => {
    // isLastStage && newTimeLeft <= 0, but this path at line 70 is reached
    // when newTimeLeft <= 0 AND isLastStage (handled earlier at line 45-46 for negative)
    // Line 70 is: the newTimeLeft=0 case where it slips past the isLastStage && newTimeLeft<=0 check
    // Actually line 46 catches isLastStage && newTimeLeft<=0, but line 70 is also isLastStage
    // Let's check: line 45 returns for isLastStage && newTimeLeft<=0, so line 70 is unreachable for last stage
    // The task says check carefully — line 70 is dead code for last stage. Let's verify:
    // If isLastStage && newTimeLeft<=0, line 45-46 returns early. So line 70 is never hit for last stage.
    // This means line 70 may be covered by another test or is dead code.
    // The task said to check; let's test the non-last stage newTimeLeft<=0 → advanceStage path instead.
    const stages = buildStages(DEFAULT_CONFIG);
    const state = makeRunningState(1, { currentStage: 0 });
    jest.setSystemTime(FIXED_NOW + 2000); // elapses 2s past 0
    const next = timerReducer(state, { type: 'TICK' });
    // Should advance stage (advanceStage path)
    expect(next.currentStage).toBe(1);
  });
});

describe('TICK — advanceStage sounds', () => {
  test('breakStart: level stage expires and next stage is a break', () => {
    // stages[1] (level2) → stages[2] (break)
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[1].type).toBe('level');
    expect(stages[2].type).toBe('break');

    const state = makeRunningState(1, { currentStage: 1 });
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.currentStage).toBe(2);
    expect(next.pendingSound).toBe('breakStart');
  });

  test('breakOver: break stage expires and next stage is a level', () => {
    // stages[2] (break) → stages[3] (level3)
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[2].type).toBe('break');
    expect(stages[3].type).toBe('level');

    const state = makeRunningState(1, { currentStage: 2 });
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.currentStage).toBe(3);
    expect(next.pendingSound).toBe('breakOver');
  });

  test('blindsUp: level stage expires and next stage is also a level', () => {
    // stages[0] (level1) → stages[1] (level2)
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[0].type).toBe('level');
    expect(stages[1].type).toBe('level');

    const state = makeRunningState(1, { currentStage: 0 });
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.currentStage).toBe(1);
    expect(next.pendingSound).toBe('blindsUp');
  });
});

describe('OPEN_SETTINGS', () => {
  test('when already paused: just changes screen without modifying elapsed time', () => {
    const state = makeState({ isPaused: true, screen: 'timer', elapsedBeforePause: 100 });
    const next = timerReducer(state, { type: 'OPEN_SETTINGS' });
    expect(next.screen).toBe('settings');
    expect(next.isPaused).toBe(true);
    expect(next.elapsedBeforePause).toBe(100); // unchanged
  });
});

describe('SAVE_DISPLAY_CONFIG', () => {
  test('saves config without resetting timer state', () => {
    const state = makeRunningState(500, { currentStage: 1 });
    const newConfig = { ...DEFAULT_CONFIG, showCombos: false };
    const next = timerReducer(state, { type: 'SAVE_DISPLAY_CONFIG', config: newConfig });
    expect(next.config.showCombos).toBe(false);
    expect(next.currentStage).toBe(1); // unchanged
    expect(next.isPaused).toBe(false); // unchanged
  });
});

describe('JUMP_TO_END', () => {
  test('sets timeLeft to 65 and elapsedBeforePause to dur-65', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const dur = stages[0].duration;
    const state = makeState({ currentStage: 0 });
    const next = timerReducer(state, { type: 'JUMP_TO_END' });
    expect(next.timeLeft).toBe(65);
    expect(next.elapsedBeforePause).toBe(dur - 65);
    expect(next.warnedOneMin).toBe(false);
    expect(next.pendingSound).toBeNull();
  });
});

describe('TOGGLE_COMBOS', () => {
  test('toggles showCombos from true to false', () => {
    const state = makeState({ config: { ...DEFAULT_CONFIG, showCombos: true } });
    const next = timerReducer(state, { type: 'TOGGLE_COMBOS' });
    expect(next.config.showCombos).toBe(false);
  });

  test('toggles showCombos from false to true', () => {
    const state = makeState({ config: { ...DEFAULT_CONFIG, showCombos: false } });
    const next = timerReducer(state, { type: 'TOGGLE_COMBOS' });
    expect(next.config.showCombos).toBe(true);
  });
});

describe('TOGGLE_GAME_PANEL', () => {
  test('toggles showPlayers from true to false', () => {
    const state = makeState({ config: { ...DEFAULT_CONFIG, showPlayers: true } });
    const next = timerReducer(state, { type: 'TOGGLE_GAME_PANEL' });
    expect(next.config.showPlayers).toBe(false);
  });

  test('toggles showPlayers from false to true', () => {
    const state = makeState({ config: { ...DEFAULT_CONFIG, showPlayers: false } });
    const next = timerReducer(state, { type: 'TOGGLE_GAME_PANEL' });
    expect(next.config.showPlayers).toBe(true);
  });
});

describe('RESTORE_DISPLAY', () => {
  test('sets showCombos and showPlayers from action payload', () => {
    const state = makeState({ config: { ...DEFAULT_CONFIG, showCombos: true, showPlayers: true } });
    const next = timerReducer(state, { type: 'RESTORE_DISPLAY', showCombos: false, showPlayers: false });
    expect(next.config.showCombos).toBe(false);
    expect(next.config.showPlayers).toBe(false);
  });

  test('preserves other config fields', () => {
    const state = makeState({ config: { ...DEFAULT_CONFIG, levelDuration: 25 } });
    const next = timerReducer(state, { type: 'RESTORE_DISPLAY', showCombos: true, showPlayers: true });
    expect(next.config.levelDuration).toBe(25);
  });
});

describe('RESTORE_STATE — edge cases', () => {
  test('out of bounds currentStage with persisted stages returns unchanged state', () => {
    const localState = makeState();
    const persistedStages = buildStages(DEFAULT_CONFIG);

    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 9999, // out of bounds
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stages: persistedStages,
      },
    });

    expect(next).toBe(localState); // unchanged
  });

  test('no match found when stage type mismatches and no persisted stages returns unchanged state', () => {
    const localState = makeState();
    // Request levelNum 999 which doesn't exist
    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 0,
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'level',
        levelNum: 999,
        sb: 99999,
        bb: 199999,
        stageDurationSecs: 9999999,
      },
    });

    expect(next).toBe(localState); // unchanged, no matching stage found
  });

  test('out of bounds currentStage without persisted stages falls back to findRestoredStageIndex', () => {
    const localState = makeState();
    // currentStage=-1 is out of bounds, no stages provided — should search by metadata
    // stages[0] is level1 with sb=10, bb=20
    const stages = buildStages(DEFAULT_CONFIG);
    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: -1, // out of bounds
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'level',
        levelNum: 1,
        sb: 10,
        bb: 20,
        stageDurationSecs: stages[0].duration,
      },
    });

    expect(next.currentStage).toBe(0); // found stage 0 by metadata
  });
});

describe('default case', () => {
  test('unknown action type returns state unchanged', () => {
    const state = makeState();
    // Cast to any to send unknown action type and hit the default branch
    const next = timerReducer(state, { type: 'UNKNOWN_ACTION' } as unknown as Parameters<typeof timerReducer>[1]);
    expect(next).toBe(state);
  });
});

describe('tractorMomentActive', () => {
  function makeBb300Config() {
    return {
      ...DEFAULT_CONFIG,
      blindLevels: [
        { sb: 25, bb: 50 },
        { sb: 75, bb: 150 },
        { sb: 150, bb: 300 },
      ],
    };
  }

  test('sets tractorMomentActive when timeLeft crosses 60s before BB=300 level', () => {
    const config = makeBb300Config();
    const stages = buildStages(config);
    // stage 0 = level 25/50, stage 1 = break, stage 2 = level 75/150, etc.
    // Find the level stage whose bb=150 (the one BEFORE the bb=300 level)
    const levelStageIdx = stages.findIndex(
      (s): s is import('@/types/timer').LevelStage => s.type === 'level' && s.bb === 150
    );
    const state = makeState({
      config,
      stages,
      currentStage: levelStageIdx,
      isPaused: false,
      anchorTs: FIXED_NOW,
      elapsedBeforePause: stages[levelStageIdx].duration - 61,
      timeLeft: 61,
      warnedOneMin: false,
      tractorMomentActive: false,
    });
    jest.setSystemTime(FIXED_NOW + 1000); // timeLeft 61 → 60
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.tractorMomentActive).toBe(true);
    expect(next.pendingSound).toBeNull(); // standard warnBlinds suppressed
    expect(next.warnedOneMin).toBe(true);
  });

  test('does NOT set tractorMomentActive when next level BB != 300', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const state = makeState({
      stages,
      currentStage: 0,
      isPaused: false,
      anchorTs: FIXED_NOW,
      elapsedBeforePause: stages[0].duration - 61,
      timeLeft: 61,
      warnedOneMin: false,
      tractorMomentActive: false,
    });
    jest.setSystemTime(FIXED_NOW + 1000);
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.tractorMomentActive).toBe(false);
    expect(next.pendingSound).not.toBeNull(); // standard sound plays
  });

  test('suppresses tick sound during tractorMomentActive', () => {
    const config = makeBb300Config();
    const stages = buildStages(config);
    const levelStageIdx = stages.findIndex(
      (s): s is import('@/types/timer').LevelStage => s.type === 'level' && s.bb === 150
    );
    const state = makeState({
      config,
      stages,
      currentStage: levelStageIdx,
      isPaused: false,
      anchorTs: FIXED_NOW,
      elapsedBeforePause: stages[levelStageIdx].duration - 4,
      timeLeft: 4,
      warnedOneMin: true,
      tractorMomentActive: true,
    });
    jest.setSystemTime(FIXED_NOW + 1000); // timeLeft 4 → 3 (in tick zone)
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBeNull(); // tick suppressed
  });

  test('resets tractorMomentActive on NEXT_STAGE', () => {
    const state = makeState({ tractorMomentActive: true });
    const next = timerReducer(state, { type: 'NEXT_STAGE' });
    expect(next.tractorMomentActive).toBe(false);
  });

  test('resets tractorMomentActive on PREV_STAGE', () => {
    const state = makeState({ currentStage: 1, tractorMomentActive: true });
    const next = timerReducer(state, { type: 'PREV_STAGE' });
    expect(next.tractorMomentActive).toBe(false);
  });

  test('resets tractorMomentActive on RESET_STAGE', () => {
    const state = makeState({ tractorMomentActive: true });
    const next = timerReducer(state, { type: 'RESET_STAGE' });
    expect(next.tractorMomentActive).toBe(false);
  });

  test('resets tractorMomentActive on RESTART', () => {
    const state = makeState({ tractorMomentActive: true });
    const next = timerReducer(state, { type: 'RESTART' });
    expect(next.tractorMomentActive).toBe(false);
  });
});

describe('RESTORE_STATE — stageMatchesRestoredInfo branches', () => {
  test('no stageType in payload: stageMatchesRestoredInfo returns true (any stage matches)', () => {
    // Branch 1: !restored.stageType → return true (line 18 true branch)
    // Branch 12: findRestoredStageIndex with no stageType → return -1
    // To hit branch 1, we need stageMatchesRestoredInfo called with no stageType
    // This happens when currentStage is in bounds but !hasPersistedStages and we call stageMatchesRestoredInfo
    // Actually to hit the else if on line 258, we need stage NOT matching. But with no stageType, it always returns true.
    // Let's have currentStage in bounds, no persisted stages, no stageType — it should match trivially.
    const localState = makeState();
    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 0,
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        // no stageType — stageMatchesRestoredInfo will return true
      },
    });
    expect(next.currentStage).toBe(0);
  });

  test('levelNum mismatch causes stageMatchesRestoredInfo to return false (covers branch 8)', () => {
    // stages[0] is level1 (levelNum=1). Providing levelNum=99 should cause mismatch → findRestoredStageIndex returns -1
    const localState = makeState();
    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 0,
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'level',
        levelNum: 99, // mismatches all stages → findRestoredStageIndex returns -1 → return state
      },
    });
    expect(next).toBe(localState); // no match found, returns unchanged
  });

  test('sb mismatch causes stageMatchesRestoredInfo to return false (covers branch 10)', () => {
    // stages[0] is level1 with sb=10, levelNum=1.
    // Provide matching levelNum=1 but wrong sb — passes levelNum check, fails sb check
    // Since all stages have unique sb, searching with wrong sb returns -1
    const localState = makeState();
    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 0,
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'level',
        // no levelNum — skips levelNum check, goes to sb check
        sb: 99999, // mismatches all stages → findRestoredStageIndex returns -1
      },
    });
    expect(next).toBe(localState);
  });

  test('match against break stage (stage.type !== level, covers branch 5 false)', () => {
    // RESTORE_STATE with stageType='break', no persisted stages, currentStage pointing to non-break stage
    // so it falls into the else if (stageMatchesRestoredInfo fails for stages[0] which is level)
    // then findRestoredStageIndex finds the break stage (stages[2])
    const localState = makeState();
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[2].type).toBe('break');

    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: 0, // points to level stage, but stageType=break → mismatch → search
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'break',
        stageDurationSecs: stages[2].duration,
      },
    });
    // Should find stages[2] (first break)
    expect(next.currentStage).toBe(2);
  });

  test('out of bounds with no persisted stages and findRestoredStageIndex succeeds (branch 40 false)', () => {
    // currentStage=-1 (out of bounds), no stages, stageType matches stages[2] (break)
    const localState = makeState();
    const stages = buildStages(DEFAULT_CONFIG);

    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: -1, // out of bounds
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'break',
        stageDurationSecs: stages[2].duration,
      },
    });
    // findRestoredStageIndex should find stages[2]
    expect(next.currentStage).toBe(2);
  });

  test('out of bounds with no persisted stages and findRestoredStageIndex returns -1 (branch 40 true)', () => {
    // currentStage=-1 (out of bounds), no stages, stageType with impossible match → -1 → return state
    const localState = makeState();
    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: -1, // out of bounds
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        stageType: 'level',
        levelNum: 9999, // no such level → -1 → returns unchanged
      },
    });
    expect(next).toBe(localState);
  });

  test('out of bounds with no stageType: findRestoredStageIndex returns -1 (branch 12 true)', () => {
    // currentStage=-1 (out of bounds), no stages, no stageType → findRestoredStageIndex returns -1 immediately
    const localState = makeState();
    const next = timerReducer(localState, {
      type: 'RESTORE_STATE',
      payload: {
        currentStage: -1, // out of bounds
        anchorTs: FIXED_NOW,
        elapsedBeforePause: 0,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        // no stageType
      },
    });
    expect(next).toBe(localState); // findRestoredStageIndex returns -1, state returned unchanged
  });
});
