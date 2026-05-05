import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';
import { SessionSetup } from '@/components/SessionSetup/SessionSetup';
import type { Player, Session } from '@/types/game';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/context/TimerContext', () => ({ useTimer: jest.fn() }));
jest.mock('@/components/SessionSetup/PrizeConfig', () => ({
  PrizeConfig: ({ spots, onSpotsChange }: { spots: number; onSpotsChange: (n: number) => void }) => (
    <div data-testid="prize-config">spots: {spots}</div>
  ),
}));

const mockPlayers: Player[] = [
  { id: 'p1', name: 'Alice', avatarUrl: null, createdAt: '' },
  { id: 'p2', name: 'Bob', avatarUrl: null, createdAt: '' },
  { id: 'p3', name: 'Charlie', avatarUrl: null, createdAt: '' },
];

const mockActiveSession: Session = {
  id: 'session-1',
  buyIn: 1000,
  initialStack: 2000,
  rebuyCost: 1000,
  rebuyChips: 2000,
  maxRebuys: 1,
  addonCost: 1000,
  addonChips: 3000,
  prizeSpots: 3,
  prizePcts: [50, 30, 20],
  numberOfTables: 1,
  mergeThreshold: 0,
  tablesMergedAt: null,
  status: 'active',
  createdAt: '2024-01-01',
};

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
  (useTimer as jest.Mock).mockReturnValue({ dispatch: mockTimerDispatch });

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
  test('renders "▶ Начать игру" button when no active session', () => {
    setupMocks();
    render(<SessionSetup />);
    expect(screen.getByRole('button', { name: '▶ Начать игру' })).toBeInTheDocument();
  });

  test('does not render start button when activeSession is provided', () => {
    setupMocks({ activeSession: mockActiveSession, sessionPlayers: [] });
    render(<SessionSetup />);
    expect(screen.queryByRole('button', { name: '▶ Начать игру' })).not.toBeInTheDocument();
  });

  test('start button is disabled when fewer than 2 players selected', () => {
    setupMocks();
    render(<SessionSetup />);
    expect(screen.getByRole('button', { name: '▶ Начать игру' })).toBeDisabled();
  });

  test('selecting 2 players enables start button', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);
    const alice = screen.getByRole('checkbox', { name: /Alice/i });
    const bob = screen.getByRole('checkbox', { name: /Bob/i });
    await user.click(alice);
    await user.click(bob);
    expect(screen.getByRole('button', { name: '▶ Начать игру' })).toBeEnabled();
  });

  test('shows table count toggle with one table selected by default', () => {
    setupMocks();
    render(<SessionSetup />);

    expect(screen.getByText('Кол-во столов')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Порог объединения')).not.toBeInTheDocument();
  });

  test('selecting two tables shows merge threshold and selected-player table toggles', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Порог объединения')).toBeInTheDocument();
    expect(screen.getByText('Допустимый диапазон: [2, 1]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Стол 1' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Alice/i }));

    expect(screen.getByRole('button', { name: 'Стол 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Стол 2' })).toHaveAttribute('aria-pressed', 'false');
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
      expect.objectContaining({ numberOfTables: 1, mergeThreshold: 0, tablesMergedAt: null }),
      ['p1', 'p2'],
      { p1: 1, p2: 1 }
    );
  });

  test('starting two-table setup passes player table assignments', async () => {
    const { mockStartSession } = setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);

    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('checkbox', { name: /Alice/i }));
    await user.click(screen.getByRole('checkbox', { name: /Bob/i }));
    await user.click(screen.getAllByRole('button', { name: 'Стол 2' })[1]);
    await user.click(screen.getByRole('button', { name: '▶ Начать игру' }));

    await waitFor(() => expect(mockStartSession).toHaveBeenCalledTimes(1));
    expect(mockStartSession).toHaveBeenCalledWith(
      expect.objectContaining({ numberOfTables: 2, mergeThreshold: 2, tablesMergedAt: null }),
      ['p1', 'p2'],
      { p1: 1, p2: 2 }
    );
  });

  test('after startSession, calls timerDispatch with { type: "RESTART" }', async () => {
    const { mockTimerDispatch } = setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);
    await user.click(screen.getByRole('checkbox', { name: /Alice/i }));
    await user.click(screen.getByRole('checkbox', { name: /Bob/i }));
    await user.click(screen.getByRole('button', { name: '▶ Начать игру' }));
    await waitFor(() => expect(mockTimerDispatch).toHaveBeenCalledWith({ type: 'RESTART' }));
  });

  test('shows "🔒 активная сессия" badge when locked', () => {
    setupMocks({ activeSession: mockActiveSession, sessionPlayers: [] });
    render(<SessionSetup />);
    expect(screen.getByText(/активная сессия/)).toBeInTheDocument();
  });

  test('shows all players as checkboxes', () => {
    setupMocks();
    render(<SessionSetup />);
    expect(screen.getByRole('checkbox', { name: /Alice/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Bob/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Charlie/i })).toBeInTheDocument();
  });

  test('shows "Добавьте игроков" when players list is empty', () => {
    setupMocks({ players: [] });
    render(<SessionSetup />);
    expect(screen.getByText(/Добавьте игроков/)).toBeInTheDocument();
  });

  test('"Макс. ребаев" input is shown when rebuyCost > 0 (default 1000)', () => {
    setupMocks();
    render(<SessionSetup />);
    // The label text contains "Макс. ребаев" — find it by text then confirm the input is in the DOM
    expect(screen.getByText(/Макс\. ребаев/)).toBeInTheDocument();
    // The section containing this label should also have an input
    const label = screen.getByText(/Макс\. ребаев/);
    const input = label.closest('div')!.querySelector('input');
    expect(input).toBeInTheDocument();
  });

  test('"Макс. ребаев" input is hidden when rebuyCost is set to 0', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);

    // Find the rebuy cost input via its label text "Ребай (RSD)"
    const rebuyCostLabel = screen.getByText('Ребай (RSD)');
    const rebuyCostField = rebuyCostLabel.closest('div')!.querySelector('input') as HTMLInputElement;

    await user.clear(rebuyCostField);
    await user.type(rebuyCostField, '0');

    expect(screen.queryByText(/Макс\. ребаев/)).not.toBeInTheDocument();
  });

  test('financial inputs are disabled when session is locked', () => {
    setupMocks({ activeSession: mockActiveSession, sessionPlayers: [] });
    render(<SessionSetup />);

    const buyInLabel = screen.getByText('Взнос (RSD)');
    const buyInInput = buyInLabel.closest('div')!.querySelector('input') as HTMLInputElement;
    expect(buyInInput).toBeDisabled();
  });

  test('clicking a selected player checkbox deselects it', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<SessionSetup />);

    const alice = screen.getByRole('checkbox', { name: /Alice/i });
    await user.click(alice); // select
    expect(alice).toBeChecked();

    await user.click(alice); // deselect
    expect(alice).not.toBeChecked();
  });
});
