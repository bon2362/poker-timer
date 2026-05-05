import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerRow } from '@/components/GamePanel/PlayerRow';
import type { Player, Session, SessionPlayer } from '@/types/game';

jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

jest.mock('@/context/MinuteTimerContext', () => ({
  useMinuteTimer: jest.fn(),
}));

jest.mock('@/components/PlayerManager/PlayerManager', () => ({
  Avatar: () => <div data-testid="avatar" />,
}));

import { useGame } from '@/context/GameContext';
import { useMinuteTimer } from '@/context/MinuteTimerContext';

const mockUseGame = useGame as jest.Mock;
const mockUseMinuteTimer = useMinuteTimer as jest.Mock;

const player: Player = {
  id: 'player-1',
  name: 'Ivan',
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
};

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
  mergeThreshold: 4,
  tablesMergedAt: null,
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
};

function sp(overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return {
    id: 'sp-1',
    sessionId: 'session-1',
    playerId: 'player-1',
    rebuys: 0,
    hasAddon: false,
    status: 'playing',
    finishPosition: null,
    eliminatedAt: null,
    tableNumber: 1,
    ...overrides,
  };
}

function setup(session: Session, sessionPlayer = sp()) {
  const movePlayerToTable = jest.fn().mockResolvedValue(undefined);
  const startMinute = jest.fn();
  mockUseGame.mockReturnValue({
    players: [player],
    activeSession: session,
    sessionPlayers: [sessionPlayer, sp({ id: 'sp-2', playerId: 'player-2' })],
    doRebuy: jest.fn(),
    undoRebuy: jest.fn(),
    doAddon: jest.fn(),
    undoAddon: jest.fn(),
    movePlayerToTable,
    eliminatePlayer: jest.fn(),
    undoEliminate: jest.fn(),
    declareWinner: jest.fn(),
  });
  mockUseMinuteTimer.mockReturnValue({ startMinute });
  return { movePlayerToTable, startMinute };
}

describe('PlayerRow table movement', () => {
  test('moves a table-1 player to table 2 from the expanded menu', async () => {
    const sessionPlayer = sp({ tableNumber: 1 });
    const { movePlayerToTable } = setup(baseSession, sessionPlayer);
    const user = userEvent.setup();

    render(<PlayerRow sp={sessionPlayer} />);
    await user.click(screen.getByText('Ivan'));
    await user.click(screen.getByRole('button', { name: '→ Стол 2' }));

    expect(movePlayerToTable).toHaveBeenCalledWith('sp-1', 2);
  });

  test('shows return-to-table-1 action for table-2 players', async () => {
    const sessionPlayer = sp({ tableNumber: 2 });
    setup(baseSession, sessionPlayer);
    const user = userEvent.setup();

    render(<PlayerRow sp={sessionPlayer} />);
    await user.click(screen.getByText('Ivan'));

    expect(screen.getByRole('button', { name: '← Стол 1' })).toBeInTheDocument();
  });

  test('hides move action for one-table and merged sessions', async () => {
    const user = userEvent.setup();
    const sessionPlayer = sp({ tableNumber: 1 });

    setup({ ...baseSession, numberOfTables: 1 }, sessionPlayer);
    const { rerender } = render(<PlayerRow sp={sessionPlayer} />);
    await user.click(screen.getByText('Ivan'));
    expect(screen.queryByRole('button', { name: /Стол/ })).not.toBeInTheDocument();

    setup({ ...baseSession, tablesMergedAt: '2026-05-06T00:00:00Z' }, sessionPlayer);
    rerender(<PlayerRow sp={sessionPlayer} />);
    expect(screen.queryByRole('button', { name: /Стол/ })).not.toBeInTheDocument();
  });

  test('keeps minute timer action global and unchanged', async () => {
    const sessionPlayer = sp({ tableNumber: 1 });
    const { startMinute } = setup(baseSession, sessionPlayer);
    const user = userEvent.setup();

    render(<PlayerRow sp={sessionPlayer} />);
    await user.click(screen.getByText('Ivan'));
    await user.click(screen.getByRole('button', { name: /Минуту/ }));

    expect(startMinute).toHaveBeenCalledWith('Ivan', 'player-1');
  });
});
