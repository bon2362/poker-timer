import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileAdminPanel } from '@/components/MobileAdminPanel';
import type { Player, Session, SessionPlayer } from '@/types/game';

jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

jest.mock('@/context/TimerContext', () => ({
  useTimer: jest.fn(),
}));

jest.mock('@/context/MinuteTimerContext', () => ({
  useMinuteTimer: jest.fn(() => ({ startMinute: jest.fn() })),
}));

jest.mock('@/components/PlayerManager/PlayerManager', () => ({
  Avatar: () => <div data-testid="avatar" />,
}));

import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';

const mockUseGame = useGame as jest.Mock;
const mockUseTimer = useTimer as jest.Mock;

const players: Player[] = [
  { id: 'p1', name: 'Alice', avatarUrl: null, createdAt: '' },
  { id: 'p2', name: 'Bob', avatarUrl: null, createdAt: '' },
];

const baseSession: Session = {
  id: 'session-1',
  buyIn: 1000,
  initialStack: 10000,
  rebuyCost: 0,
  rebuyChips: 0,
  maxRebuys: 0,
  addonCost: 0,
  addonChips: 0,
  prizeSpots: 3,
  prizePcts: [50, 30, 20],
  numberOfTables: 2,
  mergeThreshold: 2,
  tablesMergedAt: null,
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
};

function sp(overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return {
    id: 'sp-1',
    sessionId: 'session-1',
    playerId: 'p1',
    rebuys: 0,
    hasAddon: false,
    status: 'playing',
    finishPosition: null,
    eliminatedAt: null,
    tableNumber: 1,
    ...overrides,
  };
}

function setup(session: Session = baseSession) {
  const confirmMerge = jest.fn().mockResolvedValue(undefined);
  const timerDispatch = jest.fn();
  mockUseGame.mockReturnValue({
    activeSession: session,
    sessionPlayers: [sp(), sp({ id: 'sp-2', playerId: 'p2', tableNumber: 2 })],
    players,
    confirmMerge,
    doRebuy: jest.fn(),
    undoRebuy: jest.fn(),
    doAddon: jest.fn(),
    undoAddon: jest.fn(),
    eliminatePlayer: jest.fn(),
    declareWinner: jest.fn(),
    undoEliminate: jest.fn(),
  });
  mockUseTimer.mockReturnValue({
    state: { config: { showPlayers: true, showCombos: true } },
    dispatch: timerDispatch,
  });
  return { confirmMerge, timerDispatch };
}

describe('MobileAdminPanel merge dialog', () => {
  test('shows merge dialog and auto-pauses at threshold', async () => {
    const { timerDispatch } = setup();

    render(<MobileAdminPanel onClose={jest.fn()} />);

    expect(screen.getByText('Объединить столы?')).toBeInTheDocument();
    await waitFor(() => expect(timerDispatch).toHaveBeenCalledWith({ type: 'PAUSE_TIMER' }));
  });

  test('cancel closes dialog and resumes timer', async () => {
    const { timerDispatch } = setup();
    const user = userEvent.setup();

    render(<MobileAdminPanel onClose={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByText('Объединить столы?')).not.toBeInTheDocument();
    expect(timerDispatch).toHaveBeenCalledWith({ type: 'RESUME_TIMER' });
  });

  test('confirm calls merge and resumes timer', async () => {
    const { confirmMerge, timerDispatch } = setup();
    const user = userEvent.setup();

    render(<MobileAdminPanel onClose={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Объединить' }));

    await waitFor(() => expect(confirmMerge).toHaveBeenCalledTimes(1));
    expect(timerDispatch).toHaveBeenCalledWith({ type: 'RESUME_TIMER' });
  });

  test('hides merge dialog after realtime marks session merged', () => {
    setup({ ...baseSession, tablesMergedAt: '2026-05-06T00:00:00Z' });

    render(<MobileAdminPanel onClose={jest.fn()} />);

    expect(screen.queryByText('Объединить столы?')).not.toBeInTheDocument();
  });
});
