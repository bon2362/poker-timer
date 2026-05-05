import { render, screen } from '@testing-library/react';
import { GamePanel } from '@/components/GamePanel/GamePanel';
import type { Session, SessionPlayer } from '@/types/game';

jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

jest.mock('@/components/GamePanel/PlayerRow', () => ({
  PlayerRow: ({ sp }: { sp: SessionPlayer }) => <div data-testid="player-row">{sp.playerId}</div>,
}));

jest.mock('@/components/GamePanel/PrizeSummary', () => ({
  PrizeSummary: () => <div data-testid="prize-summary" />,
}));

import { useGame } from '@/context/GameContext';
const mockUseGame = useGame as jest.Mock;

const baseSession: Session = {
  id: 'session-1',
  buyIn: 1000,
  initialStack: 10000,
  rebuyCost: 500,
  rebuyChips: 5000,
  maxRebuys: 0,
  addonCost: 500,
  addonChips: 5000,
  prizeSpots: 3,
  prizePcts: [50, 30, 20],
  numberOfTables: 1,
  mergeThreshold: 0,
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

function setup(session: Session, sessionPlayers: SessionPlayer[]) {
  mockUseGame.mockReturnValue({ activeSession: session, sessionPlayers });
}

describe('GamePanel', () => {
  test('groups active players by table while two-table session is unmerged', () => {
    setup(
      { ...baseSession, numberOfTables: 2 },
      [
        sp({ id: 'sp-1', playerId: 'p1', tableNumber: 1 }),
        sp({ id: 'sp-2', playerId: 'p2', tableNumber: 2 }),
        sp({ id: 'sp-3', playerId: 'p3', tableNumber: 2, hasAddon: true }),
        sp({ id: 'sp-4', playerId: 'p4', tableNumber: 1, status: 'eliminated', finishPosition: 4 }),
      ]
    );

    render(<GamePanel isOpen onToggle={jest.fn()} />);

    expect(screen.getByText('Стол 1 (1)')).toBeInTheDocument();
    expect(screen.getByText('Стол 2 (2)')).toBeInTheDocument();
    expect(screen.getByText('Вылетели (1)')).toBeInTheDocument();
    expect(screen.getAllByText('Фишек в игре')).toHaveLength(2);
  });

  test('keeps empty table section visible before merge', () => {
    setup(
      { ...baseSession, numberOfTables: 2 },
      [sp({ id: 'sp-1', playerId: 'p1', tableNumber: 1 })]
    );

    render(<GamePanel isOpen onToggle={jest.fn()} />);

    expect(screen.getByText('Стол 1 (1)')).toBeInTheDocument();
    expect(screen.getByText('Стол 2 (0)')).toBeInTheDocument();
  });

  test('renders a single active list after merge', () => {
    setup(
      { ...baseSession, numberOfTables: 2, tablesMergedAt: '2026-05-06T00:00:00Z' },
      [
        sp({ id: 'sp-1', playerId: 'p1', tableNumber: 1 }),
        sp({ id: 'sp-2', playerId: 'p2', tableNumber: 1 }),
      ]
    );

    render(<GamePanel isOpen onToggle={jest.fn()} />);

    expect(screen.queryByText(/Стол 1/)).not.toBeInTheDocument();
    expect(screen.getByText('В игре (2)')).toBeInTheDocument();
    expect(screen.getByText('Фишек в игре')).toBeInTheDocument();
  });
});
