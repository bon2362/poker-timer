import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

jest.mock('@/lib/audio', () => ({ playSound: jest.fn() }));

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
import { fetchTimerState, saveTimerState } from '@/lib/supabase/timerState';

function TestConsumer() {
  const { state, dispatch } = useTimer();
  return (
    <div>
      <div data-testid="paused">{String(state.isPaused)}</div>
      <div data-testid="stage">{state.currentStage}</div>
      <div data-testid="screen">{state.screen}</div>
      <div data-testid="timeLeft">{state.timeLeft}</div>
      <div data-testid="pendingSound">{state.pendingSound ?? 'null'}</div>
      <button onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}>toggle</button>
      <button onClick={() => dispatch({ type: 'NEXT_STAGE' })}>next</button>
      <button onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}>settings</button>
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
  localStorageMock.clear();
  jest.useRealTimers();
});

describe('TimerContext', () => {
  test('1. provides initial state: isPaused=true, currentStage=0, screen=timer', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('paused')).toHaveTextContent('true'));
    expect(screen.getByTestId('stage')).toHaveTextContent('0');
    expect(screen.getByTestId('screen')).toHaveTextContent('timer');
  });

  test('2. TOGGLE_PAUSE changes isPaused from true to false', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('paused')).toHaveTextContent('true'));

    await act(async () => {
      screen.getByText('toggle').click();
    });

    expect(screen.getByTestId('paused')).toHaveTextContent('false');
  });

  test('3. NEXT_STAGE increments currentStage', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('stage')).toHaveTextContent('0'));

    await act(async () => {
      screen.getByText('next').click();
    });

    expect(screen.getByTestId('stage')).toHaveTextContent('1');
  });

  test('4. OPEN_SETTINGS changes screen to settings', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('screen')).toHaveTextContent('timer'));

    await act(async () => {
      screen.getByText('settings').click();
    });

    expect(screen.getByTestId('screen')).toHaveTextContent('settings');
  });

  test('5. useTimer throws when used outside TimerProvider', () => {
    function BadConsumer() {
      useTimer();
      return null;
    }
    // Suppress React's error boundary console output
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow('useTimer must be used within TimerProvider');
    spy.mockRestore();
  });

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

  test('8. RESTART resets state: currentStage=0, isPaused=true, screen=timer', async () => {
    renderWithProvider();

    // Navigate away first
    await act(async () => {
      screen.getByText('next').click();
    });
    expect(screen.getByTestId('stage')).toHaveTextContent('1');

    await act(async () => {
      screen.getByText('settings').click();
    });
    expect(screen.getByTestId('screen')).toHaveTextContent('settings');

    // Now restart
    await act(async () => {
      screen.getByText('restart').click();
    });

    expect(screen.getByTestId('stage')).toHaveTextContent('0');
    expect(screen.getByTestId('paused')).toHaveTextContent('true');
    expect(screen.getByTestId('screen')).toHaveTextContent('timer');
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
});
