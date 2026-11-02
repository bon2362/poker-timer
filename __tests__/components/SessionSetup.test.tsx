import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';
import { SessionSetup } from '@/components/SessionSetup/SessionSetup';
import type { Player } from '@/types/game';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/context/TimerContext', () => ({ useTimer: jest.fn() }));
jest.mock('@/components/SessionSetup/PrizeConfig', () => ({
  PrizeConfig: ({ spots, onSpotsChange }: { spots: number; onSpotsChange: (n: number) => void }) => (
    <div data-testid="prize-config">spots: {spots}</div>
  ),
}));

const blindStructure = { levelDuration: 17, breakDuration: 8, breakEvery: 3, blindLevels: [{ sb: 30, bb: 60 }] };

const mockPlayers: Player[] = [
  { id: 'p1', name: 'Alice', avatarUrl: null, createdAt: '' },
  { id: 'p2', name: 'Bob', avatarUrl: null, createdAt: '' },
  { id: 'p3', name: 'Charlie', avatarUrl: null, createdAt: '' },
];


function setupMocks(overrides: Partial<ReturnType<typeof useGame>> = {}) {
  const mockStartSession = jest.fn().mockResolvedValue(undefined);
  const mockTimerDispatch = jest.fn();

  (useGame as jest.Mock).mockReturnValue({
    players: mockPlayers,
    sessionPlayers: [],
    activeSession: null,
    startSession: mockStartSession,
    ...overrides,
  });
  (useTimer as jest.Mock).mockReturnValue({ state: { config: { ...blindStructure, showPlayers: true } }, dispatch: mockTimerDispatch });

  return { mockStartSession, mockTimerDispatch };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SessionSetup', () => {

  test('start button is disabled when fewer than 2 players selected', () => {
    setupMocks();
    render(<SessionSetup />);
    expect(screen.getByRole('button', { name: '▶ Начать игру' })).toBeDisabled();
  });

  test('clicking start with 2+ players selected calls startSession', async () => {
    const { mockStartSession } = setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);
    await user.click(screen.getByRole('checkbox', { name: /Alice/i }));
    await user.click(screen.getByRole('checkbox', { name: /Bob/i }));
    await user.click(screen.getByRole('button', { name: '▶ Начать игру' }));
    await waitFor(() => expect(mockStartSession).toHaveBeenCalledTimes(1));
    expect(mockStartSession).toHaveBeenCalledWith(
      expect.objectContaining({ numberOfTables: 1, mergeThreshold: 0, tablesMergedAt: null, blindStructure }),
      ['p1', 'p2'],
      { p1: 1, p2: 1 }
    );
  });

  test('starting two-table setup passes player table assignments', async () => {
    const { mockStartSession } = setupMocks({
      players: [
        ...mockPlayers,
        { id: 'p4', name: 'Dana', avatarUrl: null, createdAt: '' },
      ],
    });
    const user = userEvent.setup();
    render(<SessionSetup />);

    await user.click(screen.getByRole('button', { name: '2' }));
    for (const name of [/Alice/i, /Bob/i, /Charlie/i, /Dana/i]) {
      await user.click(screen.getByRole('checkbox', { name }));
    }
    await user.click(screen.getAllByRole('button', { name: 'Стол 2' })[2]);
    await user.click(screen.getAllByRole('button', { name: 'Стол 2' })[3]);
    await user.click(screen.getByRole('button', { name: '▶ Начать игру' }));

    await waitFor(() => expect(mockStartSession).toHaveBeenCalledTimes(1));
    expect(mockStartSession).toHaveBeenCalledWith(
      expect.objectContaining({ numberOfTables: 2, mergeThreshold: 2, tablesMergedAt: null }),
      ['p1', 'p2', 'p3', 'p4'],
      { p1: 1, p2: 1, p3: 2, p4: 2 }
    );
  });

  test('two-table setup disables start when a table has fewer than 2 players', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);

    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('checkbox', { name: /Alice/i }));
    await user.click(screen.getByRole('checkbox', { name: /Bob/i }));
    await user.click(screen.getAllByRole('button', { name: 'Стол 2' })[1]);

    expect(screen.getByText(/минимум по 2 игрока/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▶ Начать игру' })).toBeDisabled();
  });

  test('two-table setup disables start for invalid merge threshold', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);

    await user.click(screen.getByRole('button', { name: '2' }));
    for (const name of [/Alice/i, /Bob/i, /Charlie/i]) {
      await user.click(screen.getByRole('checkbox', { name }));
    }
    await user.click(screen.getAllByRole('button', { name: 'Стол 2' })[1]);
    await user.click(screen.getAllByRole('button', { name: 'Стол 2' })[2]);

    const thresholdInput = screen.getByText('Порог объединения').closest('div')!.querySelector('input') as HTMLInputElement;
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '3');

    expect(screen.getByText(/Порог объединения должен быть/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▶ Начать игру' })).toBeDisabled();
  });
});
