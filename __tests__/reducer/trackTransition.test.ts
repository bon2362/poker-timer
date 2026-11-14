import { trackedTimerReducer } from '@/reducer/trackTransition';
import { buildStages } from '@/lib/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import type { TimerState } from '@/types/timer';

const NOW = 1_700_000_000_000;

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  const stages = buildStages(DEFAULT_CONFIG);
  return {
    stages,
    currentStage: 2,
    timeLeft: 10,
    anchorTs: NOW,
    elapsedBeforePause: 0,
    isPaused: false,
    isOver: false,
    warnedOneMin: true,
    tractorMomentActive: false,
    config: DEFAULT_CONFIG,
    pendingSound: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe('trackedTimerReducer', () => {
  it('labels the cause of a stage change: time-out, button, or another device', () => {
    const state = makeState();
    const expired = { ...state, anchorTs: NOW - state.stages[2].duration * 1000 };

    const auto = trackedTimerReducer(expired, { type: 'TICK' });
    expect(auto.lastTransition).toMatchObject({ cause: 'auto_advance', fromStage: 2, toStage: 3 });

    const back = trackedTimerReducer(state, { type: 'PREV_STAGE' });
    expect(back.lastTransition).toMatchObject({ cause: 'user:PREV_STAGE', fromStage: 2, toStage: 1 });

    const remote = trackedTimerReducer(state, {
      type: 'RESTORE_STATE',
      origin: 'broadcast',
      payload: { currentStage: 1, anchorTs: NOW, elapsedBeforePause: 0, isPaused: false, isOver: false, warnedOneMin: false },
    });
    expect(remote.lastTransition).toMatchObject({ cause: 'remote:broadcast', fromStage: 2, toStage: 1 });
  });

  it('does not record a transition for an ordinary tick', () => {
    const state = makeState({ timeLeft: 500 });
    const next = trackedTimerReducer(state, { type: 'TICK' });
    expect(next.lastTransition).toBeUndefined();
  });
});
