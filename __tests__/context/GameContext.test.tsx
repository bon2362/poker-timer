import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import type { Player } from '@/types/game';

// --- Mocks ---

const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn(),
};

const mockClient = {
  channel: jest.fn(() => mockChannel),
  removeChannel: jest.fn(),
};

jest.mock('@/supabase/client', () => ({
  getClient: jest.fn(() => mockClient),
}));

const mockFetchPlayers = jest.fn().mockResolvedValue([]);
const mockCreatePlayer = jest.fn();
const mockUpdatePlayer = jest.fn();
const mockDeletePlayer = jest.fn();

jest.mock('@/lib/supabase/players', () => ({
  fetchPlayers: (...args: unknown[]) => mockFetchPlayers(...args),
  createPlayer: (...args: unknown[]) => mockCreatePlayer(...args),
  updatePlayer: (...args: unknown[]) => mockUpdatePlayer(...args),
  deletePlayer: (...args: unknown[]) => mockDeletePlayer(...args),
}));

const mockFetchActiveSession = jest.fn().mockResolvedValue({ session: null, sessionPlayers: [] });
const mockCreateSession = jest.fn();
const mockUpdateSessionPlayer = jest.fn();
const mockFinishSession = jest.fn();
const mockMergeTables = jest.fn();

jest.mock('@/lib/supabase/sessions', () => ({
  fetchActiveSession: (...args: unknown[]) => mockFetchActiveSession(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  updateSessionPlayer: (...args: unknown[]) => mockUpdateSessionPlayer(...args),
  finishSession: (...args: unknown[]) => mockFinishSession(...args),
  mergeTables: (...args: unknown[]) => mockMergeTables(...args),
}));

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// --- Imports after mocks ---
import { GameProvider, useGame } from '@/context/GameContext';

// --- Test helpers ---

function TestConsumer() {
  const { players, activeSession, loading, addPlayer } = useGame();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="players-count">{players.length}</div>
      <div data-testid="session">{activeSession ? 'active' : 'none'}</div>
      <button
        onClick={() => addPlayer('Test Player')}
        data-testid="add-player-btn"
      >
        add player
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <GameProvider>
      <TestConsumer />
    </GameProvider>
  );
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();

  // Reset mocks to their defaults
  mockFetchPlayers.mockResolvedValue([]);
  mockFetchActiveSession.mockResolvedValue({ session: null, sessionPlayers: [] });
  mockChannel.on.mockReturnThis();
});

describe('GameContext', () => {
  test('1. renders without error and shows initial loading state', async () => {
    // Make fetch hang so we can observe loading=true
    mockFetchPlayers.mockReturnValue(new Promise(() => {}));
    mockFetchActiveSession.mockReturnValue(new Promise(() => {}));

    renderWithProvider();

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  test('2. after data loads, players list is populated', async () => {
    const twoPlayers: Player[] = [
      { id: '1', name: 'Alice', avatarUrl: null, createdAt: '2024-01-01T00:00:00Z' },
      { id: '2', name: 'Bob', avatarUrl: null, createdAt: '2024-01-01T00:00:00Z' },
    ];
    mockFetchPlayers.mockResolvedValue(twoPlayers);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );

    expect(screen.getByTestId('players-count')).toHaveTextContent('2');
  });

  test('3. after data loads, activeSession is null when fetchActiveSession returns null', async () => {
    mockFetchActiveSession.mockResolvedValue({ session: null, sessionPlayers: [] });

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );

    expect(screen.getByTestId('session')).toHaveTextContent('none');
  });

  test('4. addPlayer calls createPlayer and updates players list', async () => {
    const newPlayer: Player = {
      id: 'new-1',
      name: 'Test Player',
      avatarUrl: null,
      createdAt: '2024-01-01T00:00:00Z',
    };
    mockCreatePlayer.mockResolvedValue(newPlayer);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );

    expect(screen.getByTestId('players-count')).toHaveTextContent('0');

    await act(async () => {
      screen.getByTestId('add-player-btn').click();
    });

    expect(mockCreatePlayer).toHaveBeenCalledWith('Test Player');
    expect(screen.getByTestId('players-count')).toHaveTextContent('1');
  });

  test('5. useGame throws when used outside GameProvider', () => {
    function BadConsumer() {
      useGame();
      return null;
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow('useGame must be used within GameProvider');
    spy.mockRestore();
  });

  test('6. loading starts as true and becomes false after initial fetch', async () => {
    renderWithProvider();

    // Initially loading
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    // Eventually resolves
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );
  });
});

// ---------------------------------------------------------------------------
// Extended tests: action creators and Realtime callbacks
// ---------------------------------------------------------------------------

const mockSession = {
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
  status: 'active' as const,
  createdAt: '2024-01-01T00:00:00Z',
};

const mockSp = {
  id: 'sp-1',
  sessionId: 'session-1',
  playerId: 'p-1',
  rebuys: 0,
  hasAddon: false,
  status: 'playing' as const,
  finishPosition: null,
  eliminatedAt: null,
  tableNumber: 1,
};

const mockSpRow = {
  id: 'sp-1',
  session_id: 'session-1',
  player_id: 'p-1',
  rebuys: 0,
  has_addon: false,
  status: 'playing',
  finish_position: null,
  eliminated_at: null,
  table_number: 1,
};

let gameCtxRef: ReturnType<typeof import('@/context/GameContext').useGame> | null = null;

function ExtendedTestConsumer() {
  const ctx = useGame();
  gameCtxRef = ctx;
  const { players, activeSession, sessionPlayers, showWinner, loading } = ctx;
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="players-count">{players.length}</div>
      <div data-testid="session">{activeSession ? activeSession.id : 'none'}</div>
      <div data-testid="session-players-count">{sessionPlayers.length}</div>
      <div data-testid="show-winner">{String(showWinner)}</div>
    </div>
  );
}

function renderExtended() {
  return render(
    <GameProvider>
      <ExtendedTestConsumer />
    </GameProvider>
  );
}

describe('GameContext — extended actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    gameCtxRef = null;

    const alice: Player = { id: 'p-1', name: 'Alice', avatarUrl: null, createdAt: '' };
    mockFetchPlayers.mockResolvedValue([alice]);
    mockFetchActiveSession.mockResolvedValue({ session: mockSession, sessionPlayers: [mockSp] });
    mockChannel.on.mockReturnThis();
  });

  async function waitReady() {
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  }

  test('7. updatePlayer updates player in list', async () => {
    const updated: Player = { id: 'p-1', name: 'Alice Renamed', avatarUrl: null, createdAt: '' };
    mockUpdatePlayer.mockResolvedValue(updated);

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.updatePlayer('p-1', { name: 'Alice Renamed' });
    });

    expect(mockUpdatePlayer).toHaveBeenCalledWith('p-1', { name: 'Alice Renamed' });
  });

  test('8. removePlayer removes player when no active session involvement', async () => {
    // Start with no session so the guard doesn't block
    mockFetchActiveSession.mockResolvedValue({ session: null, sessionPlayers: [] });

    renderExtended();
    await waitReady();
    expect(screen.getByTestId('players-count')).toHaveTextContent('1');

    await act(async () => {
      await gameCtxRef!.removePlayer('p-1');
    });

    expect(mockDeletePlayer).toHaveBeenCalledWith('p-1');
    expect(screen.getByTestId('players-count')).toHaveTextContent('0');
  });

  test('9. removePlayer is blocked when player is in active session', async () => {
    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.removePlayer('p-1');
    });

    expect(mockDeletePlayer).not.toHaveBeenCalled();
  });

  test('10. startSession calls createSession and sets active session', async () => {
    mockFetchActiveSession.mockResolvedValue({ session: null, sessionPlayers: [] });
    mockCreateSession.mockResolvedValue({ session: mockSession, sessionPlayers: [mockSp] });

    renderExtended();
    await waitReady();
    expect(screen.getByTestId('session')).toHaveTextContent('none');

    await act(async () => {
      await gameCtxRef!.startSession(
        { buyIn: 1000, initialStack: 2000, rebuyCost: 1000, rebuyChips: 2000, maxRebuys: 1, addonCost: 1000, addonChips: 3000, prizeSpots: 3, prizePcts: [50, 30, 20], numberOfTables: 1, mergeThreshold: 0, tablesMergedAt: null },
        ['p-1']
      );
    });

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('session')).toHaveTextContent('session-1');
  });

  test('11. doRebuy calls updateSessionPlayer with incremented rebuys', async () => {
    const updatedSp = { ...mockSp, rebuys: 1 };
    mockUpdateSessionPlayer.mockResolvedValue(updatedSp);

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.doRebuy('sp-1');
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', { rebuys: 1 });
  });

  test('12. doRebuy is blocked when sp.rebuys >= maxRebuys', async () => {
    const atLimitSp = { ...mockSp, rebuys: 1 }; // maxRebuys = 1 in mockSession
    mockFetchActiveSession.mockResolvedValue({ session: mockSession, sessionPlayers: [atLimitSp] });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.doRebuy('sp-1');
    });

    expect(mockUpdateSessionPlayer).not.toHaveBeenCalled();
  });

  test('13. eliminatePlayer calls updateSessionPlayer with status=eliminated', async () => {
    mockUpdateSessionPlayer.mockResolvedValue({ ...mockSp, status: 'eliminated', finishPosition: 1 });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.eliminatePlayer('sp-1');
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', expect.objectContaining({
      status: 'eliminated',
    }));
  });

  test('14. declareWinner calls updateSessionPlayer and sets showWinner=true', async () => {
    mockUpdateSessionPlayer.mockResolvedValue({ ...mockSp, status: 'winner', finishPosition: 1 });

    renderExtended();
    await waitReady();
    expect(screen.getByTestId('show-winner')).toHaveTextContent('false');

    await act(async () => {
      await gameCtxRef!.declareWinner('sp-1');
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', { status: 'winner', finishPosition: 1 });
    expect(screen.getByTestId('show-winner')).toHaveTextContent('true');
  });

  test('15. finishGame calls finishSession and clears active session', async () => {
    mockFinishSession.mockResolvedValue(undefined);

    renderExtended();
    await waitReady();
    expect(screen.getByTestId('session')).toHaveTextContent('session-1');

    await act(async () => {
      await gameCtxRef!.finishGame();
    });

    expect(mockFinishSession).toHaveBeenCalledWith('session-1');
    expect(screen.getByTestId('session')).toHaveTextContent('none');
  });

  test('16. Realtime INSERT session_players → session-player added to state', async () => {
    mockFetchActiveSession.mockResolvedValue({ session: mockSession, sessionPlayers: [] });

    renderExtended();
    await waitReady();
    expect(screen.getByTestId('session-players-count')).toHaveTextContent('0');

    // Find the INSERT session_players callback
    const call = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'INSERT' && filter.table === 'session_players'
    );
    const callback = call![2];

    await act(async () => {
      callback({ new: mockSpRow });
    });

    expect(screen.getByTestId('session-players-count')).toHaveTextContent('1');
  });

  test('17. Realtime UPDATE sessions (status=finished) → clears active session', async () => {
    renderExtended();
    await waitReady();
    expect(screen.getByTestId('session')).toHaveTextContent('session-1');

    const call = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'sessions'
    );
    const callback = call![2];

    await act(async () => {
      callback({ new: { status: 'finished' } });
    });

    expect(screen.getByTestId('session')).toHaveTextContent('none');
  });

  test('18. doAddon calls updateSessionPlayer with hasAddon=true', async () => {
    mockUpdateSessionPlayer.mockResolvedValue({ ...mockSp, hasAddon: true });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.doAddon('sp-1');
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', { hasAddon: true });
  });

  test('19. undoEliminate restores player to playing status', async () => {
    const eliminatedSp = { ...mockSp, status: 'eliminated' as const, finishPosition: 2, eliminatedAt: '2024-01-01' };
    mockFetchActiveSession.mockResolvedValue({ session: mockSession, sessionPlayers: [eliminatedSp] });
    mockUpdateSessionPlayer.mockResolvedValue({ ...eliminatedSp, status: 'playing', finishPosition: null, eliminatedAt: null });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.undoEliminate('sp-1');
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', {
      status: 'playing',
      finishPosition: null,
      eliminatedAt: null,
    });
  });

  test('20. undoRebuy decrements rebuys', async () => {
    const spWithRebuy = { ...mockSp, rebuys: 2 };
    mockFetchActiveSession.mockResolvedValue({ session: mockSession, sessionPlayers: [spWithRebuy] });
    mockUpdateSessionPlayer.mockResolvedValue({ ...spWithRebuy, rebuys: 1 });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.undoRebuy('sp-1');
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', { rebuys: 1 });
  });

  test('21. undoRebuy is skipped when rebuys=0', async () => {
    renderExtended(); // mockSp has rebuys=0
    await waitReady();

    await act(async () => {
      await gameCtxRef!.undoRebuy('sp-1');
    });

    expect(mockUpdateSessionPlayer).not.toHaveBeenCalled();
  });

  test('22. undoAddon calls updateSessionPlayer with hasAddon=false', async () => {
    const spWithAddon = { ...mockSp, hasAddon: true };
    mockFetchActiveSession.mockResolvedValue({ session: mockSession, sessionPlayers: [spWithAddon] });
    mockUpdateSessionPlayer.mockResolvedValue({ ...spWithAddon, hasAddon: false });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.undoAddon('sp-1');
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', { hasAddon: false });
  });

  test('22b. movePlayerToTable updates tableNumber', async () => {
    mockUpdateSessionPlayer.mockResolvedValue({ ...mockSp, tableNumber: 2 });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.movePlayerToTable('sp-1', 2);
    });

    expect(mockUpdateSessionPlayer).toHaveBeenCalledWith('sp-1', { tableNumber: 2 });
  });

  test('23. Realtime UPDATE session_players with status=winner → showWinner=true', async () => {
    renderExtended();
    await waitReady();
    expect(screen.getByTestId('show-winner')).toHaveTextContent('false');

    const call = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'session_players'
    );
    const callback = call![2];

    await act(async () => {
      callback({ new: { ...mockSpRow, status: 'winner' } });
    });

    expect(screen.getByTestId('show-winner')).toHaveTextContent('true');
  });

  test('23b. confirmMerge calls RPC and refetches active session once', async () => {
    const mergedSession = { ...mockSession, numberOfTables: 2, tablesMergedAt: '2026-05-06T00:00:00Z' };
    mockMergeTables.mockResolvedValue(mergedSession);
    mockFetchActiveSession
      .mockResolvedValueOnce({ session: mockSession, sessionPlayers: [mockSp] })
      .mockResolvedValueOnce({ session: mergedSession, sessionPlayers: [{ ...mockSp, tableNumber: 1 }] });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.confirmMerge();
    });

    expect(mockMergeTables).toHaveBeenCalledWith('session-1');
    expect(mockFetchActiveSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('session')).toHaveTextContent('session-1');
  });

  test('23c. confirmMerge suppresses its own merged session realtime echo', async () => {
    const mergedSession = { ...mockSession, numberOfTables: 2, tablesMergedAt: '2026-05-06T00:00:00Z' };
    mockMergeTables.mockResolvedValue(mergedSession);
    mockFetchActiveSession
      .mockResolvedValueOnce({ session: mockSession, sessionPlayers: [mockSp] })
      .mockResolvedValueOnce({ session: mergedSession, sessionPlayers: [{ ...mockSp, tableNumber: 1 }] });

    renderExtended();
    await waitReady();

    await act(async () => {
      await gameCtxRef!.confirmMerge();
    });

    const sessionUpdate = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'sessions'
    )![2];

    await act(async () => {
      await sessionUpdate({ new: { status: 'active', tables_merged_at: '2026-05-06T00:00:00Z' } });
    });

    expect(mockFetchActiveSession).toHaveBeenCalledTimes(2);
  });

  test('23d. confirmMerge suppresses realtime echo before RPC promise resolves', async () => {
    const mergedSession = { ...mockSession, numberOfTables: 2, tablesMergedAt: '2026-05-06T00:00:00Z' };
    let resolveMerge!: (value: typeof mergedSession) => void;
    mockMergeTables.mockReturnValue(new Promise(resolve => { resolveMerge = resolve; }));
    mockFetchActiveSession
      .mockResolvedValueOnce({ session: mockSession, sessionPlayers: [mockSp] })
      .mockResolvedValueOnce({ session: mergedSession, sessionPlayers: [{ ...mockSp, tableNumber: 1 }] });

    renderExtended();
    await waitReady();

    let mergePromise!: Promise<void>;
    await act(async () => {
      mergePromise = gameCtxRef!.confirmMerge();
    });

    const sessionUpdate = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'sessions'
    )![2];

    await act(async () => {
      await sessionUpdate({ new: { status: 'active', tables_merged_at: '2026-05-06T00:00:00Z' } });
    });

    expect(mockFetchActiveSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMerge(mergedSession);
      await mergePromise;
    });

    expect(mockFetchActiveSession).toHaveBeenCalledTimes(2);
  });


  test('24. Realtime INSERT sessions → fetches and sets new session', async () => {
    mockFetchActiveSession
      .mockResolvedValueOnce({ session: null, sessionPlayers: [] }) // initial load
      .mockResolvedValueOnce({ session: mockSession, sessionPlayers: [mockSp] }); // after INSERT

    renderExtended();
    await waitReady();
    expect(screen.getByTestId('session')).toHaveTextContent('none');

    const call = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'INSERT' && filter.table === 'sessions'
    );
    const callback = call![2];

    await act(async () => {
      await callback({});
    });

    expect(screen.getByTestId('session')).toHaveTextContent('session-1');
  });

  test('25. Realtime UPDATE sessions (status=active) → fetches and updates session', async () => {
    const newSession = { ...mockSession, id: 'session-2' };
    mockFetchActiveSession
      .mockResolvedValueOnce({ session: mockSession, sessionPlayers: [mockSp] })
      .mockResolvedValueOnce({ session: newSession, sessionPlayers: [] });

    renderExtended();
    await waitReady();

    const call = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'sessions'
    );
    const callback = call![2];

    await act(async () => {
      await callback({ new: { status: 'active' } });
    });

    expect(screen.getByTestId('session')).toHaveTextContent('session-2');
  });

  test('25b. Realtime merged session refetches once and suppresses bulk session_player updates', async () => {
    const mergedSession = { ...mockSession, tablesMergedAt: '2026-05-06T00:00:00Z' };
    mockFetchActiveSession
      .mockResolvedValueOnce({ session: mockSession, sessionPlayers: [mockSp] })
      .mockResolvedValueOnce({ session: mergedSession, sessionPlayers: [{ ...mockSp, tableNumber: 1 }] });

    renderExtended();
    await waitReady();

    const sessionUpdate = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'sessions'
    )![2];
    const playerUpdate = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'session_players'
    )![2];

    await act(async () => {
      await sessionUpdate({ new: { status: 'active', tables_merged_at: '2026-05-06T00:00:00Z' } });
      playerUpdate({ new: { ...mockSpRow, id: 'sp-2', player_id: 'p-2' } });
    });

    expect(mockFetchActiveSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('session-players-count')).toHaveTextContent('1');
  });

  test('25c. Waiting merge prompt suppresses bulk player updates before merged session event', async () => {
    const promptSession = { ...mockSession, numberOfTables: 2, mergeThreshold: 1 };
    const mergedSession = { ...promptSession, tablesMergedAt: '2026-05-06T00:00:00Z' };
    mockFetchActiveSession
      .mockResolvedValueOnce({ session: promptSession, sessionPlayers: [mockSp] })
      .mockResolvedValueOnce({ session: mergedSession, sessionPlayers: [{ ...mockSp, tableNumber: 1 }] });

    renderExtended();
    await waitReady();

    const sessionUpdate = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'sessions'
    )![2];
    const playerUpdate = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'UPDATE' && filter.table === 'session_players'
    )![2];

    await act(async () => {
      playerUpdate({ new: { ...mockSpRow, id: 'sp-2', player_id: 'p-2' } });
      await sessionUpdate({ new: { status: 'active', tables_merged_at: '2026-05-06T00:00:00Z' } });
    });

    expect(mockFetchActiveSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('session-players-count')).toHaveTextContent('1');
  });

  test('26. ADD_SESSION_PLAYER dedup: duplicate INSERT updates existing sp instead of adding', async () => {
    mockFetchActiveSession.mockResolvedValue({ session: mockSession, sessionPlayers: [mockSp] });

    renderExtended();
    await waitReady();
    expect(screen.getByTestId('session-players-count')).toHaveTextContent('1');

    const call = mockChannel.on.mock.calls.find(
      ([type, filter]) => type === 'postgres_changes' && filter.event === 'INSERT' && filter.table === 'session_players'
    );
    const callback = call![2];

    // Send same sp id again — should update, not add
    await act(async () => {
      callback({ new: { ...mockSpRow, rebuys: 1 } });
    });

    // Count stays at 1 (dedup logic)
    expect(screen.getByTestId('session-players-count')).toHaveTextContent('1');
  });
});
