import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  MinuteTimerProvider,
  useMinuteTimer,
} from '@/context/MinuteTimerContext';
import {
  fetchMinuteTimerState,
  saveMinuteTimerState,
} from '@/lib/supabase/minuteTimerState';

jest.mock('@/supabase/client', () => ({
  getClient: jest.fn(() => null),
}));

jest.mock('@/lib/supabase/minuteTimerState', () => ({
  fetchMinuteTimerState: jest.fn().mockResolvedValue(null),
  saveMinuteTimerState: jest.fn().mockResolvedValue(undefined),
}));

function TestConsumer() {
  const { state, startMinute, stopMinute } = useMinuteTimer();
  return (
    <div>
      <div data-testid="active">{String(state.active)}</div>
      <div data-testid="playerName">{state.playerName}</div>
      <div data-testid="playerId">{state.playerId}</div>
      <div data-testid="timeLeft">{state.timeLeft}</div>
      <button onClick={() => startMinute('Alice', 'p-1')}>start</button>
      <button onClick={stopMinute}>stop</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <MinuteTimerProvider>
      <TestConsumer />
    </MinuteTimerProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(1_700_000_000_000);
  (fetchMinuteTimerState as jest.Mock).mockResolvedValue(null);
  (saveMinuteTimerState as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MinuteTimerContext', () => {
  test('restores active minute timer on cold start', async () => {
    (fetchMinuteTimerState as jest.Mock).mockResolvedValueOnce({
      active: true,
      playerName: 'Alice',
      playerId: 'p-1',
      endTs: 1_700_000_030_000,
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('true'));
    expect(screen.getByTestId('playerName')).toHaveTextContent('Alice');
    expect(screen.getByTestId('playerId')).toHaveTextContent('p-1');
    expect(screen.getByTestId('timeLeft')).toHaveTextContent('30');
  });

  test('startMinute persists durable state', async () => {
    renderWithProvider();

    await act(async () => {
      screen.getByText('start').click();
    });

    expect(screen.getByTestId('active')).toHaveTextContent('true');
    await waitFor(() => expect(saveMinuteTimerState).toHaveBeenCalledWith({
      active: true,
      playerName: 'Alice',
      playerId: 'p-1',
      endTs: 1_700_000_060_000,
    }));
  });

  test('stopMinute persists inactive state', async () => {
    renderWithProvider();

    await act(async () => {
      screen.getByText('start').click();
      screen.getByText('stop').click();
    });

    await waitFor(() => expect(saveMinuteTimerState).toHaveBeenLastCalledWith({
      active: false,
      playerName: '',
      playerId: '',
      endTs: 0,
    }));
  });
});
