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

jest.mock('@/lib/supabase/sessions', () => ({
  fetchActiveSession: (...args: unknown[]) => mockFetchActiveSession(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  updateSessionPlayer: (...args: unknown[]) => mockUpdateSessionPlayer(...args),
  finishSession: (...args: unknown[]) => mockFinishSession(...args),
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
