// context/GameContext.tsx
'use client';
import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import type { Player, Session, SessionPlayer, NewSessionData } from '@/types/game';
import { fetchPlayers, createPlayer, updatePlayer as updatePlayerDB, deletePlayer as deletePlayerDB } from '@/lib/supabase/players';
import { fetchActiveSession, createSession, updateSessionPlayer, finishSession } from '@/lib/supabase/sessions';
import { getClient } from '@/supabase/client';

function rowToSessionPlayer(row: Record<string, unknown>): SessionPlayer {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    playerId: row.player_id as string,
    rebuys: row.rebuys as number,
    hasAddon: row.has_addon as boolean,
    status: row.status as SessionPlayer['status'],
    finishPosition: row.finish_position as number | null,
    eliminatedAt: row.eliminated_at as string | null,
    tableNumber: (row.table_number as number | null) ?? 1,
  };
}

// ── State ──────────────────────────────────────────────────────────────────

type GameState = {
  players: Player[];
  activeSession: Session | null;
  sessionPlayers: SessionPlayer[];
  showWinner: boolean;
  loading: boolean;
};

type GameAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_PLAYERS'; players: Player[] }
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'UPDATE_PLAYER'; player: Player }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'SET_SESSION'; session: Session | null; sessionPlayers: SessionPlayer[] }
  | { type: 'ADD_SESSION_PLAYER'; sessionPlayer: SessionPlayer }
  | { type: 'UPDATE_SESSION_PLAYER'; sessionPlayer: SessionPlayer }
  | { type: 'SHOW_WINNER' }
  | { type: 'HIDE_WINNER' };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_PLAYERS':
      return { ...state, players: action.players };
    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, action.player] };
    case 'UPDATE_PLAYER':
      return { ...state, players: state.players.map(p => p.id === action.player.id ? action.player : p) };
    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter(p => p.id !== action.id) };
    case 'SET_SESSION':
      return { ...state, activeSession: action.session, sessionPlayers: action.sessionPlayers };
    case 'ADD_SESSION_PLAYER': {
      const exists = state.sessionPlayers.some(sp => sp.id === action.sessionPlayer.id);
      if (exists) {
        return { ...state, sessionPlayers: state.sessionPlayers.map(sp => sp.id === action.sessionPlayer.id ? action.sessionPlayer : sp) };
      }
      return { ...state, sessionPlayers: [...state.sessionPlayers, action.sessionPlayer] };
    }
    case 'UPDATE_SESSION_PLAYER':
      return {
        ...state,
        sessionPlayers: state.sessionPlayers.map(sp =>
          sp.id === action.sessionPlayer.id ? action.sessionPlayer : sp
        ),
      };
    case 'SHOW_WINNER':
      return { ...state, showWinner: true };
    case 'HIDE_WINNER':
      return { ...state, showWinner: false };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────

type GameContextValue = {
  // state
  players: Player[];
  activeSession: Session | null;
  sessionPlayers: SessionPlayer[];
  showWinner: boolean;
  loading: boolean;
  // player actions
  addPlayer: (name: string) => Promise<Player | null>;
  updatePlayer: (id: string, updates: Partial<Pick<Player, 'name' | 'avatarUrl'>>) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  // session actions
  startSession: (data: NewSessionData, playerIds: string[], playerTables?: Record<string, number>) => Promise<void>;
  doRebuy: (sessionPlayerId: string) => Promise<void>;
  doAddon: (sessionPlayerId: string) => Promise<void>;
  eliminatePlayer: (sessionPlayerId: string) => Promise<void>;
  undoEliminate: (sessionPlayerId: string) => Promise<void>;
  declareWinner: (sessionPlayerId: string) => Promise<void>;
  finishGame: () => Promise<void>;
  undoRebuy: (sessionPlayerId: string) => Promise<void>;
  undoAddon: (sessionPlayerId: string) => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, {
    players: [],
    activeSession: null,
    sessionPlayers: [],
    showWinner: false,
    loading: true,
  });

  // Load initial data
  useEffect(() => {
    async function load() {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        const [playersData, sessionData] = await Promise.all([
          fetchPlayers(),
          fetchActiveSession(),
        ]);
        dispatch({ type: 'SET_PLAYERS', players: playersData });
        if (sessionData) {
          dispatch({ type: 'SET_SESSION', session: sessionData.session, sessionPlayers: sessionData.sessionPlayers });
        } else {
          dispatch({ type: 'SET_SESSION', session: null, sessionPlayers: [] });
        }
      } catch (err) {
        console.error('GameContext: failed to load initial data', err);
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    }
    load();
  }, []);

  // Realtime: sync session_players and sessions changes from other devices
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    const channel = client
      .channel('game-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_players' },
        (payload) => {
          const sp = rowToSessionPlayer(payload.new as Record<string, unknown>);
          dispatch({ type: 'ADD_SESSION_PLAYER', sessionPlayer: sp });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_players' },
        (payload) => {
          const sp = rowToSessionPlayer(payload.new as Record<string, unknown>);
          dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: sp });
          if (sp.status === 'winner') dispatch({ type: 'SHOW_WINNER' });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sessions' },
        async () => {
          // New session started on another device — fetch as source of truth
          const sessionData = await fetchActiveSession();
          if (sessionData) {
            dispatch({ type: 'SET_SESSION', session: sessionData.session, sessionPlayers: sessionData.sessionPlayers });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === 'finished') {
            dispatch({ type: 'SET_SESSION', session: null, sessionPlayers: [] });
            dispatch({ type: 'HIDE_WINNER' });
          } else if (row.status === 'active') {
            const sessionData = await fetchActiveSession();
            if (sessionData) {
              dispatch({ type: 'SET_SESSION', session: sessionData.session, sessionPlayers: sessionData.sessionPlayers });
            }
          }
        }
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, []);

  const addPlayer = useCallback(async (name: string): Promise<Player | null> => {
    const player = await createPlayer(name);
    if (player) dispatch({ type: 'ADD_PLAYER', player });
    return player;
  }, []);

  const updatePlayer = useCallback(async (id: string, updates: Partial<Pick<Player, 'name' | 'avatarUrl'>>) => {
    const updated = await updatePlayerDB(id, updates);
    if (updated) dispatch({ type: 'UPDATE_PLAYER', player: updated });
  }, []);

  const removePlayer = useCallback(async (id: string) => {
    if (state.activeSession && state.sessionPlayers.some(sp => sp.playerId === id)) {
      console.warn('GameContext: cannot remove player who is in an active session');
      return;
    }
    await deletePlayerDB(id);
    dispatch({ type: 'REMOVE_PLAYER', id });
  }, [state.activeSession, state.sessionPlayers]);

  const startSession = useCallback(async (data: NewSessionData, playerIds: string[], playerTables?: Record<string, number>) => {
    const result = await createSession(data, playerIds, playerTables);
    if (result) {
      dispatch({ type: 'SET_SESSION', session: result.session, sessionPlayers: result.sessionPlayers });
    }
  }, []);

  const doRebuy = useCallback(async (sessionPlayerId: string) => {
    const sp = state.sessionPlayers.find(p => p.id === sessionPlayerId);
    if (!sp) return;
    const { maxRebuys } = state.activeSession ?? { maxRebuys: 0 };
    if (maxRebuys > 0 && sp.rebuys >= maxRebuys) return;
    const updated = await updateSessionPlayer(sessionPlayerId, { rebuys: sp.rebuys + 1 });
    if (updated) dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
  }, [state.sessionPlayers, state.activeSession]);

  const doAddon = useCallback(async (sessionPlayerId: string) => {
    const updated = await updateSessionPlayer(sessionPlayerId, { hasAddon: true });
    if (updated) dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
  }, []);

  const eliminatePlayer = useCallback(async (sessionPlayerId: string) => {
    const activePlayers = state.sessionPlayers.filter(p => p.status === 'playing');
    const position = activePlayers.length; // e.g. 4 active → this player finishes 4th
    const updated = await updateSessionPlayer(sessionPlayerId, {
      status: 'eliminated',
      finishPosition: position,
      eliminatedAt: new Date().toISOString(),
    });
    if (updated) dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
  }, [state.sessionPlayers]);

  const declareWinner = useCallback(async (sessionPlayerId: string) => {
    const updated = await updateSessionPlayer(sessionPlayerId, {
      status: 'winner',
      finishPosition: 1,
    });
    if (updated) {
      dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
      dispatch({ type: 'SHOW_WINNER' });
    }
  }, []);

  const undoEliminate = useCallback(async (sessionPlayerId: string) => {
    const updated = await updateSessionPlayer(sessionPlayerId, {
      status: 'playing',
      finishPosition: null,
      eliminatedAt: null,
    });
    if (updated) dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
  }, []);

  const undoRebuy = useCallback(async (sessionPlayerId: string) => {
    const sp = state.sessionPlayers.find(p => p.id === sessionPlayerId);
    if (!sp || sp.rebuys <= 0) return;
    const updated = await updateSessionPlayer(sessionPlayerId, { rebuys: sp.rebuys - 1 });
    if (updated) dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
  }, [state.sessionPlayers]);

  const undoAddon = useCallback(async (sessionPlayerId: string) => {
    const updated = await updateSessionPlayer(sessionPlayerId, { hasAddon: false });
    if (updated) dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
  }, []);

  const finishGame = useCallback(async () => {
    if (!state.activeSession) return;
    await finishSession(state.activeSession.id);
    dispatch({ type: 'SET_SESSION', session: null, sessionPlayers: [] });
    dispatch({ type: 'HIDE_WINNER' });
  }, [state.activeSession]);

  return (
    <GameContext.Provider value={{
      players: state.players,
      activeSession: state.activeSession,
      sessionPlayers: state.sessionPlayers,
      showWinner: state.showWinner,
      loading: state.loading,
      addPlayer, updatePlayer, removePlayer,
      startSession, doRebuy, doAddon, undoRebuy, undoAddon,
      eliminatePlayer, undoEliminate, declareWinner, finishGame,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
