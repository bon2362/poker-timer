import { render, screen, act, waitFor } from '@testing-library/react';

// --- Mocks (must be before imports that trigger them) ---

jest.mock('@/supabase/client', () => ({
  getClient: jest.fn(() => null),
  getTimerChannel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    state: 'closed',
    send: jest.fn(),
  })),
}));

jest.mock('@/lib/supabase/timerState', () => ({
  fetchTimerState: jest.fn().mockResolvedValue(null),
  isPersistedTimerStateStaleForSession: jest.fn().mockReturnValue(false),
  parsePersistedStages: jest.fn(),
  saveTimerState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase/appConfig', () => ({
  fetchAppConfig: jest.fn().mockResolvedValue(null),
  normalizeConfig: jest.fn((value) => value),
  saveAppConfig: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/audio', () => ({ playSound: jest.fn() }));

jest.mock('@/lib/supabase/sessions', () => ({ markSessionStarted: jest.fn().mockResolvedValue(undefined) }));

jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(() => ({
    activeSession: null,
    loading: false,
  })),
}));

// localStorage mock (jsdom has it but loadConfig uses it)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// --- Component under test ---
import { TimerProvider, useTimer } from '@/context/TimerContext';
import { fetchTimerState, isPersistedTimerStateStaleForSession, saveTimerState } from '@/lib/supabase/timerState';
import { fetchAppConfig, saveAppConfig } from '@/lib/supabase/appConfig';
import { getTimerChannel } from '@/supabase/client';
import { DEFAULT_CONFIG } from '@/lib/storage';
import { markSessionStarted } from '@/lib/supabase/sessions';
import { useGame } from '@/context/GameContext';

function TestConsumer() {
  const { state, dispatch } = useTimer();
  return (
    <div>
      <div data-testid="paused">{String(state.isPaused)}</div>
      <div data-testid="stage">{state.currentStage}</div>
      <div data-testid="timeLeft">{state.timeLeft}</div>
      <div data-testid="pendingSound">{state.pendingSound ?? 'null'}</div>
      <div data-testid="showCombos">{String(state.config.showCombos)}</div>
      <div data-testid="breakSong">{String(state.config.breakSongEnabled)}</div>
      <button onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}>toggle</button>
      <button onClick={() => dispatch({ type: 'NEXT_STAGE' })}>next</button>
      <button onClick={() => dispatch({ type: 'PREV_STAGE' })}>prev</button>
      <button onClick={() => dispatch({ type: 'RESET_STAGE' })}>reset-stage</button>
      <button onClick={() => dispatch({ type: 'TOGGLE_COMBOS' })}>toggle-combos</button>
      <button onClick={() => dispatch({ type: 'RESTART' })}>restart</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <TimerProvider>
      <TestConsumer />
    </TimerProvider>
  );
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  (fetchAppConfig as jest.Mock).mockResolvedValue(null);
  (saveAppConfig as jest.Mock).mockResolvedValue(undefined);
  (fetchTimerState as jest.Mock).mockResolvedValue(null);
  (isPersistedTimerStateStaleForSession as jest.Mock).mockReturnValue(false);
  (saveTimerState as jest.Mock).mockResolvedValue(undefined);
  localStorageMock.clear();
  jest.useRealTimers();
});

describe('TimerContext', () => {

  test('6. TICK decrements timeLeft when timer is running', async () => {
    jest.useFakeTimers();
    renderWithProvider();

    // Wait for initial render
    await act(async () => {});

    // Get initial timeLeft
    const initialTimeLeft = parseInt(screen.getByTestId('timeLeft').textContent ?? '0', 10);

    // Resume timer
    await act(async () => {
      screen.getByText('toggle').click();
    });
    expect(screen.getByTestId('paused')).toHaveTextContent('false');

    // Advance time by 3 seconds — TICK fires every 1000ms
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    const newTimeLeft = parseInt(screen.getByTestId('timeLeft').textContent ?? '0', 10);
    expect(newTimeLeft).toBeLessThan(initialTimeLeft);

    jest.useRealTimers();
  });

  test('7. CLEAR_SOUND is dispatched after pendingSound is processed', async () => {
    // pendingSound gets set and then cleared in the audio effect
    // We verify that after render pendingSound stays null (no spurious sounds)
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('pendingSound')).toHaveTextContent('null'));
  });

  test('9. restoring from DB does not echo stale state back to Supabase', async () => {
    (fetchTimerState as jest.Mock).mockResolvedValueOnce({
      currentStage: 1,
      anchorTs: Date.now(),
      elapsedBeforePause: 120,
      isPaused: true,
      isOver: false,
      warnedOneMin: false,
      stageType: 'level',
      levelNum: 2,
      sb: 20,
      bb: 40,
      stageDurationSecs: 1200,
      stages: [
        { type: 'level', levelNum: 1, sb: 10, bb: 20, duration: 1200 },
        { type: 'level', levelNum: 2, sb: 20, bb: 40, duration: 1200 },
      ],
      updatedAt: '2026-04-12T00:00:00.000Z',
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('1'));
    await waitFor(() => expect(saveTimerState).not.toHaveBeenCalled());
  });

  test('14. broadcast "state" from another device triggers RESTORE_STATE without echoing back to DB', async () => {
    renderWithProvider();
    await waitFor(() => expect(fetchTimerState).toHaveBeenCalled());

    const channel = (getTimerChannel as jest.Mock).mock.results[0].value;
    const broadcastCb = channel.on.mock.calls.find(
      ([type, opts]: [string, { event: string }]) => type === 'broadcast' && opts.event === 'state'
    )?.[2];

    expect(broadcastCb).toBeDefined();

    const saveCallsBefore = (saveTimerState as jest.Mock).mock.calls.length;

    // Send a broadcast that mirrors current state (stage 0, paused) — echo suppression fires
    await act(async () => {
      broadcastCb({
        payload: {
          currentStage: 0,
          anchorTs: 0,
          elapsedBeforePause: 0,
          isPaused: true,
          isOver: false,
          warnedOneMin: false,
          stageType: 'level',
          levelNum: 1,
          sb: 10,
          bb: 20,
          stageDurationSecs: 1200,
        },
      });
    });

    // Echo suppression: saveTimerState should NOT be called for received broadcast
    expect((saveTimerState as jest.Mock).mock.calls.length).toBe(saveCallsBefore);
  });

  test('10. identical DB restore does not block the next local sync', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    (fetchTimerState as jest.Mock).mockResolvedValueOnce({
      currentStage: 0,
      anchorTs: 1700000000000,
      elapsedBeforePause: 0,
      isPaused: true,
      isOver: false,
      warnedOneMin: false,
      stageType: 'level',
      levelNum: 1,
      sb: 10,
      bb: 20,
      stageDurationSecs: 1200,
      stages: [
        { type: 'level', levelNum: 1, sb: 10, bb: 20, duration: 1200 },
        { type: 'level', levelNum: 2, sb: 20, bb: 40, duration: 1200 },
      ],
      updatedAt: '2026-04-12T00:00:00.000Z',
    });

    renderWithProvider();

    await waitFor(() => expect(fetchTimerState).toHaveBeenCalled());
    expect(saveTimerState).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByText('toggle').click();
    });

    await waitFor(() => expect(saveTimerState).toHaveBeenCalledWith(expect.objectContaining({
      isPaused: false,
      anchorTs: 1700000000000,
    })));

    nowSpy.mockRestore();
  });

  test('15. stale persisted state triggers RESTART instead of RESTORE_STATE', async () => {
    const { isPersistedTimerStateStaleForSession } = jest.requireMock('@/lib/supabase/timerState');
    (isPersistedTimerStateStaleForSession as jest.Mock).mockReturnValue(true);
    (fetchTimerState as jest.Mock).mockResolvedValueOnce({
      currentStage: 3,
      anchorTs: Date.now(),
      elapsedBeforePause: 0,
      isPaused: false,
      isOver: false,
      warnedOneMin: false,
      stageType: 'level',
      levelNum: 4,
      sb: 100,
      bb: 200,
      stageDurationSecs: 1200,
      stages: [],
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    renderWithProvider();

    await waitFor(() => expect(fetchTimerState).toHaveBeenCalled());
    // Stale state → RESTART dispatched → currentStage stays 0
    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('0'));
  });

  test('16. display broadcast is ignored because app_config is the durable source', async () => {
    renderWithProvider();
    await waitFor(() => expect(fetchTimerState).toHaveBeenCalled());

    const channel = (getTimerChannel as jest.Mock).mock.results[0].value;
    const displayCb = channel.on.mock.calls.find(
      ([type, opts]: [string, { event: string }]) => type === 'broadcast' && opts.event === 'display'
    )?.[2];

    expect(displayCb).toBeUndefined();
  });

  test('17. restores durable app config on cold start without another client', async () => {
    (fetchAppConfig as jest.Mock).mockResolvedValueOnce({
      ...DEFAULT_CONFIG,
      levelDuration: 5,
      breakSongEnabled: true,
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('timeLeft')).toHaveTextContent('300'));
    expect(screen.getByTestId('breakSong')).toHaveTextContent('true');
    expect(saveAppConfig).not.toHaveBeenCalled();
  });

  test('18. durable app config does not reset a restored timer_state on reload', async () => {
    (fetchAppConfig as jest.Mock).mockResolvedValueOnce({
      ...DEFAULT_CONFIG,
      levelDuration: 5,
      breakSongEnabled: true,
    });
    (fetchTimerState as jest.Mock).mockResolvedValueOnce({
      currentStage: 1,
      anchorTs: Date.now(),
      elapsedBeforePause: 120,
      isPaused: true,
      isOver: false,
      warnedOneMin: false,
      stageType: 'level',
      levelNum: 2,
      sb: 20,
      bb: 40,
      stageDurationSecs: 1200,
      stages: [
        { type: 'level', levelNum: 1, sb: 10, bb: 20, duration: 1200 },
        { type: 'level', levelNum: 2, sb: 20, bb: 40, duration: 1200 },
      ],
      updatedAt: '2026-04-12T00:00:00.000Z',
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('1'));
    expect(screen.getByTestId('timeLeft')).toHaveTextContent('1080');
    expect(screen.getByTestId('breakSong')).toHaveTextContent('true');
    expect(saveTimerState).not.toHaveBeenCalled();
  });
});

describe('game start time', () => {
  const session = { id: 'game', createdAt: new Date(Date.now() - 60000).toISOString(), startedAt: null };
  beforeEach(() => { jest.mocked(markSessionStarted).mockClear(); });
  afterEach(() => { jest.mocked(useGame).mockReturnValue({ activeSession: null, loading: false } as never); });

  test('is recorded once, on the first timer run of an active game', async () => {
    jest.mocked(useGame).mockReturnValue({ activeSession: session, loading: false } as never);
    render(<TimerProvider><TestConsumer /></TimerProvider>);
    await waitFor(() => expect(screen.getByTestId('paused')).toHaveTextContent('true'));
    expect(markSessionStarted).not.toHaveBeenCalled();
    await act(async () => { screen.getByText('toggle').click(); });
    await waitFor(() => expect(markSessionStarted).toHaveBeenCalledTimes(1));
    expect(markSessionStarted).toHaveBeenCalledWith('game', expect.any(String));
    await act(async () => { screen.getByText('toggle').click(); });
    await act(async () => { screen.getByText('toggle').click(); });
    expect(markSessionStarted).toHaveBeenCalledTimes(1);
  });

  test('is not overwritten when already recorded', async () => {
    jest.mocked(useGame).mockReturnValue({ activeSession: { ...session, startedAt: session.createdAt }, loading: false } as never);
    render(<TimerProvider><TestConsumer /></TimerProvider>);
    await waitFor(() => expect(screen.getByTestId('paused')).toHaveTextContent('true'));
    await act(async () => { screen.getByText('toggle').click(); });
    expect(markSessionStarted).not.toHaveBeenCalled();
  });
});

describe('admin connection', () => {
  afterEach(() => { jest.mocked(fetchTimerState).mockResolvedValue(null); });

  function ReadyConsumer() {
    const { configReady } = useTimer();
    return <div data-testid="ready">{String(configReady)}</div>;
  }

  test('reports when saved settings have loaded', async () => {
    render(<TimerProvider><ReadyConsumer /></TimerProvider>);
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));
  });

  test('silent connection never plays timer sounds', async () => {
    const { playSound } = jest.requireMock('@/lib/audio') as { playSound: jest.Mock };
    playSound.mockClear();
    render(<TimerProvider silent><TestConsumer /></TimerProvider>);
    await waitFor(() => expect(screen.getByTestId('paused')).toHaveTextContent('true'));
    await act(async () => { screen.getByText('next').click(); });
    await waitFor(() => expect(screen.getByTestId('pendingSound')).toHaveTextContent('null'));
    expect(playSound).not.toHaveBeenCalled();
  });
});
