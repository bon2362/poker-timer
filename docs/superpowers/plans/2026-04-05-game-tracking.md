# Game Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add player management, game session tracking with rebuys/addons/eliminations, prize pool auto-calculation, and winner screen to the poker timer app.

**Architecture:** Two React Contexts wrap the app — `GameContext` (Supabase-backed player/session state) inside `GameProvider`, and `TimerContext` (refactored from `PokerTimer.tsx`) inside `TimerProvider`. Both are provided in `app/layout.tsx`. `PokerTimer` reads both contexts: shows a blocking overlay when no session is active, unlocks the timer and adds a 🂡 panel button when a session is running.

**Tech Stack:** Next.js 15 App Router, React 19 Context + useReducer, Supabase PostgreSQL + Storage, TypeScript, Tailwind CSS 4, HTML5 Canvas API (avatar cropper, no external libs).

---

## File Map

### New files
```
types/game.ts
lib/game.ts
lib/supabase/players.ts
lib/supabase/sessions.ts
lib/supabase/storage.ts
context/GameContext.tsx
context/TimerContext.tsx
components/PlayerManager/PlayerManager.tsx
components/PlayerManager/PlayerForm.tsx
components/PlayerManager/AvatarCropper.tsx
components/SessionSetup/SessionSetup.tsx
components/SessionSetup/PrizeConfig.tsx
components/GamePanel/GamePanel.tsx
components/GamePanel/PlayerRow.tsx
components/GamePanel/PrizeSummary.tsx
components/WinnerScreen/WinnerScreen.tsx
__tests__/lib/game.test.ts
```

### Modified files
```
supabase/client.ts          export getClient()
app/layout.tsx              wrap with GameProvider + TimerProvider
components/PokerTimer.tsx   use useTimer() + useGame(), add overlay + GamePanel
components/SettingsScreen.tsx  3-tab structure (Турнир | Игроки | Оформление)
types/timer.ts              no changes
CLAUDE.md                   version bump
```

---

### Task 1: Game types

**Files:**
- Create: `types/game.ts`

- [ ] **Step 1: Create the file**

```typescript
// types/game.ts
export type SessionStatus = 'setup' | 'active' | 'finished'
export type PlayerStatus = 'playing' | 'eliminated' | 'winner'

export type Player = {
  id: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

export type Session = {
  id: string
  buyIn: number           // RSD
  initialStack: number    // chips
  rebuyCost: number       // RSD, 0 = disabled
  rebuyChips: number      // chips per rebuy
  addonCost: number       // RSD, 0 = disabled
  addonChips: number      // chips per addon
  prizeSpots: number
  prizePcts: number[]     // e.g. [50, 30, 20], must sum to 100
  status: SessionStatus
  createdAt: string
}

export type SessionPlayer = {
  id: string
  sessionId: string
  playerId: string
  rebuys: number
  hasAddon: boolean
  status: PlayerStatus
  finishPosition: number | null   // 1 = winner, 2 = runner-up, etc.
  eliminatedAt: string | null
}

export type GameStats = {
  bank: number
  totalChips: number
  avgStack: number
  payouts: number[]  // index 0 = 1st place payout
}

export type NewSessionData = Omit<Session, 'id' | 'createdAt' | 'status'>
```

- [ ] **Step 2: Commit**

```bash
git add types/game.ts
git commit -m "feat: add game types (Player, Session, SessionPlayer, GameStats)"
```

---

### Task 2: Supabase schema setup

**Action:** Run SQL in Supabase Dashboard → SQL Editor. No code files in this task.

- [ ] **Step 1: Run table migrations**

Go to https://supabase.com → project → SQL Editor → New query. Paste and run:

```sql
-- Players
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Sessions
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  buy_in          integer not null,
  initial_stack   integer not null,
  rebuy_cost      integer not null default 0,
  rebuy_chips     integer not null default 0,
  addon_cost      integer not null default 0,
  addon_chips     integer not null default 0,
  prize_spots     integer not null default 1,
  prize_pcts      integer[] not null,
  status          text not null default 'setup',
  created_at      timestamptz default now()
);

-- Session players (join table with game state)
create table if not exists session_players (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  player_id        uuid not null references players(id) on delete cascade,
  rebuys           integer not null default 0,
  has_addon        boolean not null default false,
  status           text not null default 'playing',
  finish_position  integer,
  eliminated_at    timestamptz
);
```

- [ ] **Step 2: Enable RLS with open policies (no auth yet)**

Run in SQL Editor:

```sql
alter table players enable row level security;
alter table sessions enable row level security;
alter table session_players enable row level security;

create policy "public read players"  on players  for select using (true);
create policy "public write players" on players  for all    using (true);
create policy "public read sessions"  on sessions  for select using (true);
create policy "public write sessions" on sessions  for all    using (true);
create policy "public read sp"  on session_players  for select using (true);
create policy "public write sp" on session_players  for all    using (true);
```

- [ ] **Step 3: Create avatars storage bucket**

Go to Storage → New bucket:
- Name: `avatars`
- Public: ✓ (checked)
- File size limit: 5 MB
- Allowed MIME types: `image/jpeg,image/png,image/webp`

Then run in SQL Editor to allow public uploads:

```sql
create policy "public avatar upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

create policy "public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "public avatar update"
  on storage.objects for update
  using (bucket_id = 'avatars');
```

---

### Task 3: Supabase client lib functions

**Files:**
- Modify: `supabase/client.ts` — export `getClient`
- Create: `lib/supabase/players.ts`
- Create: `lib/supabase/sessions.ts`
- Create: `lib/supabase/storage.ts`

- [ ] **Step 1: Export getClient from supabase/client.ts**

In `supabase/client.ts`, change `function getClient()` to `export function getClient()`:

```typescript
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

export function getTimerChannel(sessionId: string): RealtimeChannel {
  const client = getClient();
  if (!client) {
    return {
      subscribe: () => ({}) as unknown as RealtimeChannel,
      unsubscribe: () => Promise.resolve('ok' as const),
      send: () => Promise.resolve('ok' as const),
    } as unknown as RealtimeChannel;
  }
  return client.channel(`timer:${sessionId}`);
}
```

- [ ] **Step 2: Create lib/supabase/players.ts**

```typescript
// lib/supabase/players.ts
import { getClient } from '@/supabase/client';
import type { Player } from '@/types/game';

function toPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchPlayers(): Promise<Player[]> {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client
    .from('players')
    .select('*')
    .order('created_at');
  if (error) { console.error('fetchPlayers:', error); return []; }
  return (data ?? []).map(toPlayer);
}

export async function createPlayer(name: string): Promise<Player | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from('players')
    .insert({ name })
    .select()
    .single();
  if (error) { console.error('createPlayer:', error); return null; }
  return toPlayer(data);
}

export async function updatePlayer(id: string, updates: Partial<Pick<Player, 'name' | 'avatarUrl'>>): Promise<Player | null> {
  const client = getClient();
  if (!client) return null;
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
  const { data, error } = await client
    .from('players')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updatePlayer:', error); return null; }
  return toPlayer(data);
}

export async function deletePlayer(id: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('players').delete().eq('id', id);
  if (error) console.error('deletePlayer:', error);
}
```

- [ ] **Step 3: Create lib/supabase/sessions.ts**

```typescript
// lib/supabase/sessions.ts
import { getClient } from '@/supabase/client';
import type { Session, SessionPlayer, NewSessionData } from '@/types/game';

function toSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    buyIn: row.buy_in as number,
    initialStack: row.initial_stack as number,
    rebuyCost: row.rebuy_cost as number,
    rebuyChips: row.rebuy_chips as number,
    addonCost: row.addon_cost as number,
    addonChips: row.addon_chips as number,
    prizeSpots: row.prize_spots as number,
    prizePcts: row.prize_pcts as number[],
    status: row.status as Session['status'],
    createdAt: row.created_at as string,
  };
}

function toSessionPlayer(row: Record<string, unknown>): SessionPlayer {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    playerId: row.player_id as string,
    rebuys: row.rebuys as number,
    hasAddon: row.has_addon as boolean,
    status: row.status as SessionPlayer['status'],
    finishPosition: row.finish_position as number | null,
    eliminatedAt: row.eliminated_at as string | null,
  };
}

export async function fetchActiveSession(): Promise<{ session: Session; sessionPlayers: SessionPlayer[] } | null> {
  const client = getClient();
  if (!client) return null;
  const { data: sessionData } = await client
    .from('sessions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sessionData) return null;
  const session = toSession(sessionData);
  const { data: spData } = await client
    .from('session_players')
    .select('*')
    .eq('session_id', session.id);
  return { session, sessionPlayers: (spData ?? []).map(toSessionPlayer) };
}

export async function createSession(
  data: NewSessionData,
  playerIds: string[]
): Promise<{ session: Session; sessionPlayers: SessionPlayer[] } | null> {
  const client = getClient();
  if (!client) return null;
  const { data: sessionRow, error: sessionErr } = await client
    .from('sessions')
    .insert({
      buy_in: data.buyIn,
      initial_stack: data.initialStack,
      rebuy_cost: data.rebuyCost,
      rebuy_chips: data.rebuyChips,
      addon_cost: data.addonCost,
      addon_chips: data.addonChips,
      prize_spots: data.prizeSpots,
      prize_pcts: data.prizePcts,
      status: 'active',
    })
    .select()
    .single();
  if (sessionErr || !sessionRow) { console.error('createSession:', sessionErr); return null; }
  const session = toSession(sessionRow);
  const { data: spRows, error: spErr } = await client
    .from('session_players')
    .insert(playerIds.map(pid => ({ session_id: session.id, player_id: pid })))
    .select();
  if (spErr) { console.error('createSession session_players:', spErr); return null; }
  return { session, sessionPlayers: (spRows ?? []).map(toSessionPlayer) };
}

export async function updateSessionPlayer(
  id: string,
  updates: Partial<Pick<SessionPlayer, 'rebuys' | 'hasAddon' | 'status' | 'finishPosition' | 'eliminatedAt'>>
): Promise<SessionPlayer | null> {
  const client = getClient();
  if (!client) return null;
  const dbUpdates: Record<string, unknown> = {};
  if (updates.rebuys !== undefined) dbUpdates.rebuys = updates.rebuys;
  if (updates.hasAddon !== undefined) dbUpdates.has_addon = updates.hasAddon;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.finishPosition !== undefined) dbUpdates.finish_position = updates.finishPosition;
  if (updates.eliminatedAt !== undefined) dbUpdates.eliminated_at = updates.eliminatedAt;
  const { data, error } = await client
    .from('session_players')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updateSessionPlayer:', error); return null; }
  return toSessionPlayer(data);
}

export async function finishSession(id: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.from('sessions').update({ status: 'finished' }).eq('id', id);
}
```

- [ ] **Step 4: Create lib/supabase/storage.ts**

```typescript
// lib/supabase/storage.ts
import { getClient } from '@/supabase/client';

export async function uploadAvatar(playerId: string, blob: Blob): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const path = `${playerId}.jpg`;
  const { error } = await client.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) { console.error('uploadAvatar:', error); return null; }
  const { data } = client.storage.from('avatars').getPublicUrl(path);
  // bust cache by appending timestamp
  return `${data.publicUrl}?t=${Date.now()}`;
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/client.ts lib/supabase/
git commit -m "feat: supabase lib functions for players, sessions, storage"
```

---

### Task 4: Game calculation functions (TDD)

**Files:**
- Create: `lib/game.ts`
- Create: `__tests__/lib/game.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// __tests__/lib/game.test.ts
import { calcGameStats } from '@/lib/game';
import type { Session, SessionPlayer } from '@/types/game';

const baseSession: Session = {
  id: 's1', createdAt: '', status: 'active',
  buyIn: 1000, initialStack: 10000,
  rebuyCost: 500, rebuyChips: 5000,
  addonCost: 500, addonChips: 5000,
  prizeSpots: 3, prizePcts: [50, 30, 20],
};

function sp(overrides: Partial<SessionPlayer> = {}): SessionPlayer {
  return {
    id: 'sp1', sessionId: 's1', playerId: 'p1',
    rebuys: 0, hasAddon: false,
    status: 'playing', finishPosition: null, eliminatedAt: null,
    ...overrides,
  };
}

describe('calcGameStats', () => {
  test('basic bank with no rebuys/addons', () => {
    const players = [sp(), sp({ id: 'sp2', playerId: 'p2' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.bank).toBe(2000);
    expect(stats.totalChips).toBe(20000);
  });

  test('bank includes rebuys', () => {
    const players = [sp({ rebuys: 2 }), sp({ id: 'sp2', playerId: 'p2' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.bank).toBe(2000 + 2 * 500);
    expect(stats.totalChips).toBe(20000 + 2 * 5000);
  });

  test('bank includes addons', () => {
    const players = [sp({ hasAddon: true }), sp({ id: 'sp2', playerId: 'p2' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.bank).toBe(2000 + 500);
    expect(stats.totalChips).toBe(20000 + 5000);
  });

  test('avgStack uses only active players', () => {
    const players = [
      sp({ status: 'playing' }),
      sp({ id: 'sp2', playerId: 'p2', status: 'eliminated' }),
    ];
    const stats = calcGameStats(baseSession, players);
    expect(stats.avgStack).toBe(20000); // 20000 chips / 1 active player
  });

  test('payouts sum equals bank', () => {
    const players = [sp(), sp({ id: 'sp2', playerId: 'p2' }), sp({ id: 'sp3', playerId: 'p3' })];
    const stats = calcGameStats(baseSession, players);
    const total = stats.payouts.reduce((a, b) => a + b, 0);
    expect(total).toBe(stats.bank);
  });

  test('last payout absorbs rounding remainder', () => {
    const oddSession: Session = { ...baseSession, buyIn: 333, prizePcts: [50, 30, 20] };
    const players = [sp(), sp({ id: 'sp2', playerId: 'p2' }), sp({ id: 'sp3', playerId: 'p3' })];
    const stats = calcGameStats(oddSession, players);
    expect(stats.payouts.reduce((a, b) => a + b, 0)).toBe(stats.bank);
  });

  test('avgStack is 0 when no active players', () => {
    const players = [sp({ status: 'eliminated' })];
    const stats = calcGameStats(baseSession, players);
    expect(stats.avgStack).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
/opt/homebrew/bin/node node_modules/.bin/jest __tests__/lib/game.test.ts
```

Expected: `Cannot find module '@/lib/game'`

- [ ] **Step 3: Implement lib/game.ts**

```typescript
// lib/game.ts
import type { Session, SessionPlayer, GameStats } from '@/types/game';

export function calcGameStats(session: Session, players: SessionPlayer[]): GameStats {
  const totalPlayers = players.length;
  const totalRebuys = players.reduce((sum, p) => sum + p.rebuys, 0);
  const totalAddons = players.filter(p => p.hasAddon).length;
  const activePlayers = players.filter(p => p.status === 'playing').length;

  const bank =
    totalPlayers * session.buyIn +
    totalRebuys * session.rebuyCost +
    totalAddons * session.addonCost;

  const totalChips =
    totalPlayers * session.initialStack +
    totalRebuys * session.rebuyChips +
    totalAddons * session.addonChips;

  const avgStack = activePlayers > 0 ? Math.floor(totalChips / activePlayers) : 0;

  // Distribute payouts; last spot absorbs rounding remainder
  const payouts: number[] = [];
  let remaining = bank;
  for (let i = 0; i < session.prizeSpots - 1; i++) {
    const payout = Math.floor(bank * session.prizePcts[i] / 100);
    payouts.push(payout);
    remaining -= payout;
  }
  if (session.prizeSpots > 0) payouts.push(remaining);

  return { bank, totalChips, avgStack, payouts };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
/opt/homebrew/bin/node node_modules/.bin/jest __tests__/lib/game.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/game.ts __tests__/lib/game.test.ts
git commit -m "feat: calcGameStats pure function with TDD"
```

---

### Task 5: GameContext

**Files:**
- Create: `context/GameContext.tsx`

- [ ] **Step 1: Create context file**

```typescript
// context/GameContext.tsx
'use client';
import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import type { Player, Session, SessionPlayer, NewSessionData } from '@/types/game';
import { fetchPlayers, createPlayer, updatePlayer as updatePlayerDB, deletePlayer as deletePlayerDB } from '@/lib/supabase/players';
import { fetchActiveSession, createSession, updateSessionPlayer, finishSession } from '@/lib/supabase/sessions';

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
  startSession: (data: NewSessionData, playerIds: string[]) => Promise<void>;
  doRebuy: (sessionPlayerId: string) => Promise<void>;
  doAddon: (sessionPlayerId: string) => Promise<void>;
  eliminatePlayer: (sessionPlayerId: string) => Promise<void>;
  declareWinner: (sessionPlayerId: string) => Promise<void>;
  finishGame: () => Promise<void>;
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
      dispatch({ type: 'SET_LOADING', loading: false });
    }
    load();
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
    await deletePlayerDB(id);
    dispatch({ type: 'REMOVE_PLAYER', id });
  }, []);

  const startSession = useCallback(async (data: NewSessionData, playerIds: string[]) => {
    const result = await createSession(data, playerIds);
    if (result) {
      dispatch({ type: 'SET_SESSION', session: result.session, sessionPlayers: result.sessionPlayers });
    }
  }, []);

  const doRebuy = useCallback(async (sessionPlayerId: string) => {
    const sp = state.sessionPlayers.find(p => p.id === sessionPlayerId);
    if (!sp) return;
    const updated = await updateSessionPlayer(sessionPlayerId, { rebuys: sp.rebuys + 1 });
    if (updated) dispatch({ type: 'UPDATE_SESSION_PLAYER', sessionPlayer: updated });
  }, [state.sessionPlayers]);

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
      startSession, doRebuy, doAddon, eliminatePlayer, declareWinner, finishGame,
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
```

- [ ] **Step 2: Commit**

```bash
git add context/GameContext.tsx
git commit -m "feat: GameContext with player/session/tracking actions"
```

---

### Task 6: TimerContext (refactor from PokerTimer)

**Files:**
- Create: `context/TimerContext.tsx`

- [ ] **Step 1: Create TimerContext — move logic from PokerTimer**

```typescript
// context/TimerContext.tsx
'use client';
import { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { getTimerChannel } from '@/supabase/client';
import type { TimerState, Action } from '@/types/timer';

type TimerContextValue = {
  state: TimerState;
  dispatch: React.Dispatch<Action>;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(timerReducer, undefined, createInitialState);
  const suppressUntilRef = useRef<number>(0);
  const channelRef = useRef(getTimerChannel(process.env.NEXT_PUBLIC_SESSION_ID ?? 'main'));

  // Timer tick
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, []);

  // Audio side effects
  useEffect(() => {
    if (!state.pendingSound) return;
    const event = state.pendingSound;
    const now = Date.now();
    if (event === 'tick' && now < suppressUntilRef.current) {
      dispatch({ type: 'CLEAR_SOUND' });
      return;
    }
    if (event !== 'tick') suppressUntilRef.current = now + 3500;
    playSound(event);
    dispatch({ type: 'CLEAR_SOUND' });
  }, [state.pendingSound]);

  // Supabase broadcast
  useEffect(() => {
    const channel = channelRef.current;
    channel.subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  useEffect(() => {
    channelRef.current.send({
      type: 'broadcast',
      event: 'state',
      payload: { currentStage: state.currentStage, timeLeft: state.timeLeft, isPaused: state.isPaused },
    });
  }, [state.currentStage, state.timeLeft, state.isPaused]);

  return (
    <TimerContext.Provider value={{ state, dispatch }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add context/TimerContext.tsx
git commit -m "feat: TimerContext (extracted from PokerTimer)"
```

---

### Task 7: Wire providers in layout + refactor PokerTimer

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/PokerTimer.tsx`

- [ ] **Step 1: Update app/layout.tsx**

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from '@/context/GameContext';
import { TimerProvider } from '@/context/TimerContext';

export const metadata: Metadata = {
  title: 'Poker Timer',
  description: 'Poker tournament timer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <GameProvider>
          <TimerProvider>
            {children}
          </TimerProvider>
        </GameProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Refactor PokerTimer.tsx to use contexts**

Remove all state/effect logic (moved to TimerContext) and add session overlay + game panel button:

```typescript
// components/PokerTimer.tsx
'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useTimer } from '@/context/TimerContext';
import { useGame } from '@/context/GameContext';
import { BlindInfo } from './BlindInfo';
import { TimerDisplay } from './TimerDisplay';
import { Controls } from './Controls';
import { CombosPanel } from './CombosPanel';
import { SettingsScreen } from './SettingsScreen';
import { GamePanel } from './GamePanel/GamePanel';
import { WinnerScreen } from './WinnerScreen/WinnerScreen';
import type { Config } from '@/types/timer';

export function PokerTimer() {
  const { state, dispatch } = useTimer();
  const { activeSession, showWinner, loading } = useGame();

  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gamePanelOpen, setGamePanelOpen] = useState(false);

  // Auto-hide controls on mouse inactivity
  useEffect(() => {
    function showControls() {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    document.addEventListener('mousemove', showControls);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      document.removeEventListener('mousemove', showControls);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Keyboard: Space → toggle pause (only when session active)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!activeSession) return;
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeSession, dispatch]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleSaveSettings = useCallback((config: Config) => {
    dispatch({ type: 'SAVE_SETTINGS', config });
  }, [dispatch]);

  const stage = state.stages[state.currentStage];
  const isWarning = state.timeLeft <= 60 && state.timeLeft >= 0 && stage.type !== 'break';

  // Next blind info
  const nextStage = state.stages[state.currentStage + 1];
  let nextText = '';
  if (!nextStage) {
    nextText = 'Финал';
  } else if (nextStage.type === 'break') {
    const afterBreak = state.stages[state.currentStage + 2];
    const afterStr = afterBreak?.type === 'level' ? ` → ${afterBreak.sb}/${afterBreak.bb}` : '';
    nextText = `☕ Перерыв ${state.config.breakDuration} мин${afterStr}`;
  } else {
    nextText = `${nextStage.sb} / ${nextStage.bb}`;
  }

  if (state.screen === 'settings') {
    return (
      <SettingsScreen
        config={state.config}
        onSave={handleSaveSettings}
        onClose={() => dispatch({ type: 'CLOSE_SETTINGS' })}
        onJumpToEnd={() => {
          dispatch({ type: 'JUMP_TO_END' });
          dispatch({ type: 'CLOSE_SETTINGS' });
        }}
      />
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden select-none transition-[background] duration-[1500ms] ${isWarning ? 'bg-[#3a1a0a]' : 'bg-[#1a1a1a]'}`}>
      {/* Top bar */}
      <div className="relative w-full px-7 pt-5">
        <BlindInfo stage={stage} breakDuration={state.config.breakDuration} />
        <div className="absolute top-5 right-7 flex gap-1 items-center">
          {activeSession && (
            <button
              className="bg-transparent border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
              onClick={() => setGamePanelOpen(o => !o)}
              title="Игровая панель"
            >
              🂡
            </button>
          )}
          <button
            className="bg-transparent border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
            onClick={toggleFullscreen}
            title="Fullscreen"
          >
            ⛶
          </button>
          <button
            className="bg-transparent border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
            onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Timer */}
      {!state.isOver && <TimerDisplay timeLeft={state.timeLeft} stage={stage} isPaused={state.isPaused} />}

      {/* Tournament over */}
      {state.isOver && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <h1 className="text-[48px] font-black text-violet-600">Tournament Over</h1>
          <p className="text-[#888] text-[18px]">Хорошая игра!</p>
          <button
            className="bg-violet-700 text-white border-none rounded-lg px-6 h-11 text-[15px] cursor-pointer hover:bg-violet-800"
            onClick={() => dispatch({ type: 'RESTART' })}
          >
            ↺ Начать заново
          </button>
        </div>
      )}

      {/* Controls */}
      {!state.isOver && (
        <Controls
          isPaused={state.isPaused}
          isOver={state.isOver}
          visible={controlsVisible}
          onPrev={() => dispatch({ type: 'PREV_STAGE' })}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          onNext={() => dispatch({ type: 'NEXT_STAGE' })}
        />
      )}

      {/* Combos panel */}
      {!state.isOver && (
        <CombosPanel
          visible={state.config.showCombos !== false}
          onToggle={() => dispatch({ type: 'TOGGLE_COMBOS' })}
        />
      )}

      {/* Next blind info */}
      {!state.isOver && nextText && (
        <div className="pb-[22px] text-center pointer-events-none">
          <div className="text-[11px] text-[#383838] tracking-[2px] uppercase mb-1">Далее</div>
          <div className="font-bold text-[#444] leading-tight" style={{ fontSize: 'clamp(58px, 8vw, 96px)' }}>
            {nextText}
          </div>
        </div>
      )}

      {/* Clock */}
      <ClockDisplay />

      {/* Session overlay — shown when loading is done and no active session */}
      {!loading && !activeSession && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-8 text-center max-w-[320px]">
            <div className="text-4xl mb-4">🃏</div>
            <h2 className="text-[18px] font-semibold text-[#ccc] mb-2">Игра не настроена</h2>
            <p className="text-[14px] text-[#666] mb-6">Настройте игроков и параметры сессии перед стартом таймера</p>
            <button
              className="bg-violet-700 text-white border-none rounded-lg px-6 py-3 text-[15px] font-semibold cursor-pointer hover:bg-violet-800 w-full"
              onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            >
              Открыть настройки
            </button>
          </div>
        </div>
      )}

      {/* Game panel */}
      {gamePanelOpen && activeSession && (
        <GamePanel onClose={() => setGamePanelOpen(false)} />
      )}

      {/* Winner screen */}
      {showWinner && <WinnerScreen />}
    </div>
  );
}

function ClockDisplay() {
  const [clock, setClock] = useState('00:00');
  useEffect(() => {
    function update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClock(`${h}:${m}`);
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed bottom-[18px] right-7 text-[28px] font-bold text-[#444] tabular-nums tracking-[2px] pointer-events-none">
      {clock}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep -v __tests__
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx components/PokerTimer.tsx
git commit -m "feat: wire GameProvider+TimerProvider, refactor PokerTimer to use contexts"
```

---

### Task 8: SettingsScreen — 3-tab structure

**Files:**
- Modify: `components/SettingsScreen.tsx`

- [ ] **Step 1: Rewrite SettingsScreen with tabs**

Replace the entire file content with the tabbed version. The key change is adding a `tab` state and rendering different content per tab. The existing «Турнир» tab content preserves all current time/blinds/sound/display settings. «Игроки» and session setup components are stubs (to be implemented in Tasks 9–12).

```typescript
// components/SettingsScreen.tsx
'use client';
import { useState, Fragment } from 'react';
import type { Config, BlindLevel, SoundEvent } from '@/types/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import { playSound } from '@/lib/audio';
import { useTimer } from '@/context/TimerContext';
import { PlayerManager } from './PlayerManager/PlayerManager';
import { SessionSetup } from './SessionSetup/SessionSetup';

const CHANGELOG = [
  {
    version: '4.2',
    date: "05 April '26",
    notes: 'Управление игроками с аватарками. Настройка игровой сессии (взносы, стеки, ребай, аддон, призы). Live-трекинг: вылеты, ребаи, аддоны. Авторасчёт банка и выплат. Экран победителя.',
  },
  {
    version: '4.1',
    date: "05 April '26",
    notes: 'Авто-скрытие управления при неактивности мыши. Крупные блайнды. Следующие блайнды внизу экрана. Кнопка 1:05 перенесена в настройки.',
  },
  {
    version: '4.0',
    date: "05 April '26",
    notes: 'Переезд на Next.js 15 App Router + TypeScript + Tailwind. Supabase Realtime. Полная декомпозиция на компоненты, 38 unit-тестов.',
  },
  {
    version: '3.19',
    date: "04 April '26",
    notes: 'Голосовые уведомления, таблица покерных комбинаций, overtime-режим, предупреждение за 1 минуту.',
  },
];

function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-6 w-[340px] max-w-[90vw] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[14px] font-semibold text-[#ccc] tracking-[1px] uppercase">История версий</h2>
          <button onClick={onClose} className="text-[#555] text-[18px] hover:text-[#999] bg-transparent border-none cursor-pointer leading-none">✕</button>
        </div>
        <div className="flex flex-col gap-4">
          {CHANGELOG.map(({ version, date, notes }) => (
            <div key={version}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-violet-400 font-bold text-[13px]">v{version}</span>
                <span className="text-[#444] text-[11px]">{date}</span>
              </div>
              <p className="text-[#888] text-[12px] leading-[1.6]">{notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Tab = 'tournament' | 'players' | 'display';

type Props = {
  config: Config;
  onSave: (config: Config) => void;
  onClose: () => void;
  onJumpToEnd?: () => void;
};

type FormErrors = {
  levelDuration?: string;
  breakDuration?: string;
  breakEvery?: string;
  blinds?: string;
};

export function SettingsScreen({ config, onSave, onClose, onJumpToEnd }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('tournament');
  const [showChangelog, setShowChangelog] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tournament', label: 'Турнир' },
    { id: 'players',    label: 'Игроки' },
    { id: 'display',    label: 'Оформление' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-white">
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <button className="text-violet-500 text-[14px] bg-transparent border-none cursor-pointer" onClick={onClose}>
            ← Назад
          </button>
          {onJumpToEnd && (
            <button
              className="text-[#555] text-[11px] bg-transparent border border-[#333] rounded px-[7px] py-[3px] cursor-pointer hover:text-[#888] hover:border-[#555]"
              onClick={onJumpToEnd}
              title="Перемотать к последней минуте (для теста)"
            >
              1:05
            </button>
          )}
        </div>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-[#ccc] tracking-[1px]">НАСТРОЙКИ</h1>
          <div className="text-[11px] text-[#444] mt-[2px] cursor-pointer" onClick={() => setShowChangelog(true)}>v4.2</div>
        </div>
        <button
          className="bg-violet-700 text-white border-none rounded-lg px-[18px] py-[7px] text-[14px] font-semibold cursor-pointer hover:bg-violet-800"
          onClick={onClose}
        >
          Готово
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a2a] shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-[13px] font-medium border-none cursor-pointer transition-colors
              ${activeTab === tab.id
                ? 'text-violet-400 border-b-2 border-violet-500 bg-transparent'
                : 'text-[#555] bg-transparent hover:text-[#888]'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tournament' && (
          <TournamentTab config={config} onSave={onSave} onClose={onClose} />
        )}
        {activeTab === 'players' && <PlayerManager />}
        {activeTab === 'display' && <DisplayTab />}
      </div>
    </div>
  );
}

// ── Tournament Tab ────────────────────────────────────────────────────────

function TournamentTab({ config, onSave, onClose }: { config: Config; onSave: (c: Config) => void; onClose: () => void }) {
  const [levelDuration, setLevelDuration] = useState(String(config.levelDuration));
  const [breakDuration, setBreakDuration] = useState(String(config.breakDuration));
  const [breakEvery, setBreakEvery] = useState(String(config.breakEvery));
  const [blinds, setBlinds] = useState<BlindLevel[]>(config.blindLevels.map(l => ({ sb: l.sb, bb: l.bb })));
  const [errors, setErrors] = useState<FormErrors>({});

  const breakEveryNum = Math.max(1, parseInt(breakEvery, 10) || 1);

  function validate(): Config | null {
    const errs: FormErrors = {};
    const ld = parseInt(levelDuration, 10);
    const bd = parseInt(breakDuration, 10);
    const be = parseInt(breakEvery, 10);
    if (!ld || ld < 1 || ld > 999) errs.levelDuration = 'Введите целое число от 1 до 999';
    if (!bd || bd < 1 || bd > 999) errs.breakDuration = 'Введите целое число от 1 до 999';
    if (!be || be < 1) errs.breakEvery = 'Введите целое число ≥ 1';
    if (blinds.length === 0) errs.blinds = 'Добавьте хотя бы один уровень';
    if (blinds.some(b => !b.sb || b.sb <= 0 || !b.bb || b.bb <= 0)) errs.blinds = 'Все SB и BB должны быть положительными числами';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return null;
    return { levelDuration: ld, breakDuration: bd, breakEvery: be, showCombos: config.showCombos, blindLevels: blinds };
  }

  function handleSave() { const cfg = validate(); if (cfg) onSave(cfg); }

  function handleReset() {
    setLevelDuration(String(DEFAULT_CONFIG.levelDuration));
    setBreakDuration(String(DEFAULT_CONFIG.breakDuration));
    setBreakEvery(String(DEFAULT_CONFIG.breakEvery));
    setBlinds(DEFAULT_CONFIG.blindLevels.map(l => ({ sb: l.sb, bb: l.bb })));
    setErrors({});
  }

  function updateBlind(i: number, field: 'sb' | 'bb', value: string) {
    setBlinds(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: parseInt(value, 10) || 0 } : b));
  }

  function removeBlind(i: number) { setBlinds(prev => prev.filter((_, idx) => idx !== i)); }

  function addBlind() {
    const last = blinds[blinds.length - 1];
    setBlinds(prev => [...prev, { sb: (last?.sb || 0) * 2, bb: (last?.bb || 0) * 2 }]);
  }

  const inputBase = 'bg-[#333] border border-[#444] rounded-[6px] text-white px-[10px] py-[6px] text-[18px] font-bold w-[72px] text-center focus:outline-none focus:border-violet-600';
  const blindInputBase = 'bg-[#242424] border border-[#333] rounded-[6px] text-white px-[10px] py-[6px] text-[15px] w-[90px] text-right tabular-nums focus:outline-none focus:border-violet-600 focus:bg-[#2a2a2a]';

  const timeFields = [
    { label: 'Длительность уровня', id: 'level', val: levelDuration, set: setLevelDuration, unit: 'мин', err: errors.levelDuration },
    { label: 'Перерыв', id: 'break', val: breakDuration, set: setBreakDuration, unit: 'мин', err: errors.breakDuration },
    { label: 'Перерыв каждые', id: 'every', val: breakEvery, set: setBreakEvery, unit: 'уровня', err: errors.breakEvery },
  ];

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      {/* Time section */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Время</div>
        <div className="flex gap-3">
          {timeFields.map(({ label, id, val, set, unit, err }) => (
            <div key={id} className="flex-1 bg-[#242424] rounded-lg p-[12px_14px]">
              <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-[6px]">{label}</label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="999" value={val} onChange={e => set(e.target.value)}
                  className={`${inputBase} ${err ? 'border-red-500' : ''}`} />
                <span className="text-[#555] text-[13px]">{unit}</span>
              </div>
              {err && <div className="text-red-500 text-[11px] mt-1">{err}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Blinds section */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px] flex justify-between items-center">
          <span>Блайнды</span>
          <button onClick={handleReset} className="bg-transparent border-none text-[#444] text-[12px] cursor-pointer underline hover:text-red-500">
            сбросить к умолчаниям
          </button>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['#', 'SB', 'BB', ''].map((h, i) => (
                <th key={i} className="text-[#555] text-[11px] uppercase tracking-[1px] text-left px-2 pb-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blinds.map((level, i) => {
              const levelNum = i + 1;
              const showBreakDivider = levelNum % breakEveryNum === 0 && levelNum < blinds.length;
              return (
                <Fragment key={i}>
                  <tr>
                    <td className="px-2 py-[3px] text-[#444] text-[12px] text-center">{levelNum}</td>
                    <td className="px-2 py-[3px]">
                      <input type="number" min="1" value={level.sb || ''} onChange={e => updateBlind(i, 'sb', e.target.value)} className={blindInputBase} />
                    </td>
                    <td className="px-2 py-[3px]">
                      <input type="number" min="1" value={level.bb || ''} onChange={e => updateBlind(i, 'bb', e.target.value)} className={blindInputBase} />
                    </td>
                    <td className="px-2 py-[3px]">
                      <button onClick={() => removeBlind(i)} className="bg-transparent border-none text-[#444] cursor-pointer text-[16px] px-2 py-1 rounded hover:text-red-500 hover:bg-[#2a1a1a]">✕</button>
                    </td>
                  </tr>
                  {showBreakDivider && (
                    <tr>
                      <td colSpan={4} className="px-2 py-[6px] text-[#4a4a7a] text-[11px] tracking-[1px] border-y border-[#2a2a3a]">
                        ── ☕ Перерыв ──────────────────────
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {errors.blinds && <div className="text-red-500 text-[13px] mt-2">{errors.blinds}</div>}
        <button onClick={addBlind} className="bg-transparent border border-dashed border-[#2a2a2a] text-[#555] w-full py-2 rounded-[6px] mt-[6px] cursor-pointer text-[13px] hover:border-violet-700 hover:text-violet-500">
          + добавить уровень
        </button>
      </div>

      {/* Session setup */}
      <SessionSetup />

      {/* Save timer settings button */}
      <button
        className="bg-violet-700 text-white border-none rounded-lg px-[18px] py-[10px] text-[15px] font-semibold cursor-pointer hover:bg-violet-800 w-full"
        onClick={handleSave}
      >
        Сохранить настройки таймера
      </button>
    </div>
  );
}

// ── Display Tab ───────────────────────────────────────────────────────────

function DisplayTab() {
  const { state, dispatch } = useTimer();
  const showCombos = state.config.showCombos !== false;

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Отображение</div>
        <label className="flex items-center gap-3 cursor-pointer bg-[#242424] rounded-lg p-[12px_14px]">
          <input
            type="checkbox"
            checked={showCombos}
            onChange={() => dispatch({ type: 'TOGGLE_COMBOS' })}
            className="w-[18px] h-[18px] accent-violet-600 cursor-pointer"
          />
          <span className="text-[14px] text-[#ccc]">Показывать таблицу покерных комбинаций</span>
        </label>
      </div>
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Звук</div>
        <div className="grid grid-cols-2 gap-[8px]">
          {([
            { event: 'warnBlinds',   label: '1 мин до смены блайндов' },
            { event: 'blindsUp',     label: 'Блайнды повышаются' },
            { event: 'warnBreak',    label: '1 мин до перерыва' },
            { event: 'breakStart',   label: 'Перерыв начался' },
            { event: 'warnEndBreak', label: '1 мин до конца перерыва' },
            { event: 'breakOver',    label: 'Перерыв закончился' },
          ] as { event: SoundEvent; label: string }[]).map(({ event, label }) => (
            <button key={event} onClick={() => playSound(event)}
              className="flex items-center gap-[10px] bg-[#242424] border border-[#333] rounded-lg px-[14px] py-[10px] text-left cursor-pointer hover:border-violet-700 hover:bg-[#2a2040] hover:text-white transition-colors">
              <span className="text-[18px]">🔔</span>
              <span className="text-[12px] text-[#aaa]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep -v __tests__
```

Expected: errors about missing `PlayerManager` and `SessionSetup` imports — these will be created in Tasks 9–12. Errors on those imports only are acceptable at this stage.

- [ ] **Step 3: Commit**

```bash
git add components/SettingsScreen.tsx
git commit -m "feat: SettingsScreen 3-tab structure (Турнир | Игроки | Оформление)"
```

---

### Task 9: PlayerManager + PlayerForm

**Files:**
- Create: `components/PlayerManager/PlayerManager.tsx`
- Create: `components/PlayerManager/PlayerForm.tsx`

- [ ] **Step 1: Create PlayerForm**

```typescript
// components/PlayerManager/PlayerForm.tsx
'use client';
import { useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { uploadAvatar } from '@/lib/supabase/storage';
import { AvatarCropper } from './AvatarCropper';
import type { Player } from '@/types/game';

type Props = {
  player?: Player;   // undefined = new player
  onDone: () => void;
};

export function PlayerForm({ player, onDone }: Props) {
  const { addPlayer, updatePlayer } = useGame();
  const [name, setName] = useState(player?.name ?? '');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (player) {
      await updatePlayer(player.id, { name: name.trim() });
      onDone();
    } else {
      const created = await addPlayer(name.trim());
      if (created) onDone();
    }
    setSaving(false);
  }

  async function handleCropSave(blob: Blob) {
    if (!player) return;
    const url = await uploadAvatar(player.id, blob);
    if (url) await updatePlayer(player.id, { avatarUrl: url });
    setCropFile(null);
  }

  return (
    <>
      {cropFile && player && (
        <AvatarCropper
          file={cropFile}
          onSave={handleCropSave}
          onCancel={() => setCropFile(null)}
        />
      )}
      <div className="flex flex-col gap-3 p-4 bg-[#242424] rounded-lg">
        <input
          type="text"
          placeholder="Имя игрока"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="bg-[#333] border border-[#444] rounded-lg px-3 py-2 text-white text-[15px] focus:outline-none focus:border-violet-600"
          autoFocus
        />
        {player && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile(f); }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-transparent border border-[#444] text-[#888] rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-violet-600 hover:text-violet-400"
            >
              📷 {player.avatarUrl ? 'Заменить аватарку' : 'Загрузить аватарку'}
            </button>
          </>
        )}
        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="flex-1 bg-transparent border border-[#333] text-[#666] rounded-lg py-2 text-[13px] cursor-pointer hover:border-[#555]"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 bg-violet-700 text-white border-none rounded-lg py-2 text-[13px] font-semibold cursor-pointer hover:bg-violet-800 disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : player ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create PlayerManager**

```typescript
// components/PlayerManager/PlayerManager.tsx
'use client';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { PlayerForm } from './PlayerForm';
import type { Player } from '@/types/game';

function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#5b21b6','#1d4ed8','#065f46','#92400e','#7f1d1d'];
  const color = colors[player.name.charCodeAt(0) % colors.length];
  return player.avatarUrl ? (
    <img
      src={player.avatarUrl}
      alt={player.name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

export { Avatar };

export function PlayerManager() {
  const { players, removePlayer, activeSession } = useGame();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  async function handleDelete(player: Player) {
    const inSession = activeSession !== null;
    if (inSession) {
      alert(`Нельзя удалить игрока во время активной сессии`);
      return;
    }
    if (confirm(`Удалить ${player.name}?`)) {
      await removePlayer(player.id);
    }
  }

  return (
    <div className="px-6 py-5 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Игроки ({players.length})</div>
        <button
          onClick={() => { setAddingNew(true); setEditingId(null); }}
          className="text-violet-500 text-[13px] bg-transparent border-none cursor-pointer hover:text-violet-400"
        >
          + Добавить
        </button>
      </div>

      {addingNew && (
        <PlayerForm onDone={() => setAddingNew(false)} />
      )}

      {players.map(player => (
        <div key={player.id}>
          {editingId === player.id ? (
            <PlayerForm player={player} onDone={() => setEditingId(null)} />
          ) : (
            <div className="flex items-center gap-3 bg-[#242424] rounded-lg px-4 py-3">
              <Avatar player={player} size={40} />
              <span
                className="flex-1 text-[15px] text-[#ccc] cursor-pointer hover:text-white"
                onClick={() => setEditingId(player.id)}
              >
                {player.name}
              </span>
              <button
                onClick={() => handleDelete(player)}
                className="bg-transparent border-none text-[#444] text-[16px] cursor-pointer hover:text-red-500 px-1"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ))}

      {players.length === 0 && !addingNew && (
        <p className="text-[#555] text-[13px] text-center py-6">
          Нет игроков. Добавьте первого.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/PlayerManager/
git commit -m "feat: PlayerManager and PlayerForm components"
```

---

### Task 10: AvatarCropper

**Files:**
- Create: `components/PlayerManager/AvatarCropper.tsx`

- [ ] **Step 1: Create AvatarCropper using Canvas API**

```typescript
// components/PlayerManager/AvatarCropper.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
  file: File;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
};

const CANVAS_SIZE = 300;
const RADIUS = 130;
const CENTER = CANVAS_SIZE / 2;

export function AvatarCropper({ file, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Draw canvas whenever zoom/offset changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Base scale so the short side fits the circle diameter
    const baseScale = (RADIUS * 2) / Math.min(img.naturalWidth, img.naturalHeight);
    const scale = baseScale * zoom;
    const imgW = img.naturalWidth * scale;
    const imgH = img.naturalHeight * scale;
    const drawX = CENTER - imgW / 2 + offset.x;
    const drawY = CENTER - imgH / 2 + offset.y;

    // Draw image clipped to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, imgW, imgH);
    ctx.restore();

    // Dark overlay outside circle
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2, true); // counter-clockwise hole
    ctx.fill();

    // Circle border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }, [zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse drag
  function onMouseDown(e: React.MouseEvent) {
    setDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.offsetX + (e.clientX - dragStart.current.mouseX),
      y: dragStart.current.offsetY + (e.clientY - dragStart.current.mouseY),
    });
  }

  function onMouseUp() { setDragging(false); }

  // Touch drag
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mouseX: t.clientX, mouseY: t.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({
      x: dragStart.current.offsetX + (t.clientX - dragStart.current.mouseX),
      y: dragStart.current.offsetY + (t.clientY - dragStart.current.mouseY),
    });
  }

  // Export 256×256 crop
  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = document.createElement('canvas');
    out.width = 256;
    out.height = 256;
    const outCtx = out.getContext('2d')!;
    const scale = 256 / (RADIUS * 2);
    outCtx.drawImage(
      canvas,
      CENTER - RADIUS, CENTER - RADIUS, RADIUS * 2, RADIUS * 2,
      0, 0, 256, 256
    );
    out.toBlob(blob => { if (blob) onSave(blob); }, 'image/jpeg', 0.85);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-6 flex flex-col items-center gap-4 w-[360px]">
        <h3 className="text-[14px] font-semibold text-[#ccc] tracking-[1px] uppercase self-start">Обрезка аватарки</h3>

        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-lg cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        />

        {/* Zoom slider */}
        <div className="w-full flex items-center gap-3">
          <span className="text-[#555] text-[12px]">−</span>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1 accent-violet-600"
          />
          <span className="text-[#555] text-[12px]">+</span>
          <span className="text-[#555] text-[11px] w-[36px] text-right">{Math.round(zoom * 100)}%</span>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 self-start">
          <PreviewCircle canvasRef={canvasRef} zoom={zoom} offset={offset} />
          <span className="text-[#555] text-[12px]">Превью 48px</span>
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={onCancel} className="flex-1 bg-transparent border border-[#333] text-[#666] rounded-lg py-2 text-[13px] cursor-pointer hover:border-[#555]">
            Отмена
          </button>
          <button onClick={handleSave} className="flex-1 bg-violet-700 text-white border-none rounded-lg py-2 text-[13px] font-semibold cursor-pointer hover:bg-violet-800">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// Small live preview circle
function PreviewCircle({ canvasRef, zoom, offset }: { canvasRef: React.RefObject<HTMLCanvasElement | null>; zoom: number; offset: { x: number; y: number } }) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const src = canvasRef.current;
    const preview = previewRef.current;
    if (!src || !preview) return;
    const ctx = preview.getContext('2d')!;
    ctx.clearRect(0, 0, 48, 48);
    ctx.save();
    ctx.beginPath();
    ctx.arc(24, 24, 24, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(src, CENTER - RADIUS, CENTER - RADIUS, RADIUS * 2, RADIUS * 2, 0, 0, 48, 48);
    ctx.restore();
  }, [canvasRef, zoom, offset]);  // re-draw when zoom/offset change

  return <canvas ref={previewRef} width={48} height={48} className="rounded-full" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PlayerManager/AvatarCropper.tsx
git commit -m "feat: AvatarCropper with canvas drag+zoom, no external deps"
```

---

### Task 11: SessionSetup + PrizeConfig

**Files:**
- Create: `components/SessionSetup/PrizeConfig.tsx`
- Create: `components/SessionSetup/SessionSetup.tsx`

- [ ] **Step 1: Create PrizeConfig**

```typescript
// components/SessionSetup/PrizeConfig.tsx
'use client';

type Props = {
  spots: number;
  pcts: number[];
  onSpotsChange: (n: number) => void;
  onPctsChange: (pcts: number[]) => void;
};

const DEFAULT_PCTS: Record<number, number[]> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [45, 27, 18, 10],
  5: [40, 25, 17, 11, 7],
};

export function PrizeConfig({ spots, pcts, onSpotsChange, onPctsChange }: Props) {
  const sum = pcts.reduce((a, b) => a + b, 0);
  const isValid = sum === 100;

  function handleSpotsChange(n: number) {
    onSpotsChange(n);
    onPctsChange(DEFAULT_PCTS[n] ?? Array(n).fill(Math.floor(100 / n)));
  }

  function handlePctChange(i: number, value: string) {
    const newPcts = [...pcts];
    newPcts[i] = parseInt(value, 10) || 0;
    onPctsChange(newPcts);
  }

  const inputBase = 'bg-[#333] border border-[#444] rounded-[6px] text-white px-2 py-1 text-[14px] w-[60px] text-center focus:outline-none focus:border-violet-600 tabular-nums';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-[13px] text-[#888]">Призовых мест:</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => spots > 1 && handleSpotsChange(spots - 1)}
            className="bg-[#333] border-none text-[#888] w-7 h-7 rounded cursor-pointer hover:text-white"
          >−</button>
          <span className="text-white text-[15px] font-bold w-6 text-center">{spots}</span>
          <button
            onClick={() => spots < 8 && handleSpotsChange(spots + 1)}
            className="bg-[#333] border-none text-[#888] w-7 h-7 rounded cursor-pointer hover:text-white"
          >+</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {pcts.map((pct, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[#555] text-[12px] w-[56px]">{i + 1}-е место</span>
            <input
              type="number"
              min="0"
              max="100"
              value={pct}
              onChange={e => handlePctChange(i, e.target.value)}
              className={inputBase}
            />
            <span className="text-[#555] text-[12px]">%</span>
          </div>
        ))}
      </div>

      <div className={`text-[12px] ${isValid ? 'text-green-500' : 'text-red-400'}`}>
        Итого: {sum}% {isValid ? '✓' : `(нужно 100%)`}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SessionSetup**

```typescript
// components/SessionSetup/SessionSetup.tsx
'use client';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { PrizeConfig } from './PrizeConfig';
import type { NewSessionData } from '@/types/game';

export function SessionSetup() {
  const { players, activeSession, startSession } = useGame();

  const [buyIn, setBuyIn] = useState(String(activeSession?.buyIn ?? 1000));
  const [initialStack, setInitialStack] = useState(String(activeSession?.initialStack ?? 10000));
  const [rebuyCost, setRebuyCost] = useState(String(activeSession?.rebuyCost ?? 500));
  const [rebuyChips, setRebuyChips] = useState(String(activeSession?.rebuyChips ?? 5000));
  const [addonCost, setAddonCost] = useState(String(activeSession?.addonCost ?? 500));
  const [addonChips, setAddonChips] = useState(String(activeSession?.addonChips ?? 5000));
  const [prizeSpots, setPrizeSpots] = useState(activeSession?.prizeSpots ?? 3);
  const [prizePcts, setPrizePcts] = useState<number[]>(activeSession?.prizePcts ?? [50, 30, 20]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  if (activeSession) {
    return (
      <div className="bg-[#242424] rounded-lg p-4">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">Активная игра</div>
        <p className="text-[#888] text-[13px]">Сессия запущена. Завершите текущую игру чтобы настроить новую.</p>
      </div>
    );
  }

  function togglePlayer(id: string) {
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleStart() {
    if (selectedPlayerIds.size < 2) { alert('Выберите минимум 2 игрока'); return; }
    const sum = prizePcts.reduce((a, b) => a + b, 0);
    if (sum !== 100) { alert('Сумма призовых процентов должна быть 100%'); return; }

    const data: NewSessionData = {
      buyIn: parseInt(buyIn, 10) || 0,
      initialStack: parseInt(initialStack, 10) || 0,
      rebuyCost: parseInt(rebuyCost, 10) || 0,
      rebuyChips: parseInt(rebuyChips, 10) || 0,
      addonCost: parseInt(addonCost, 10) || 0,
      addonChips: parseInt(addonChips, 10) || 0,
      prizeSpots,
      prizePcts,
    };

    setStarting(true);
    await startSession(data, Array.from(selectedPlayerIds));
    setStarting(false);
  }

  const numInput = 'bg-[#333] border border-[#444] rounded-[6px] text-white px-3 py-2 text-[15px] font-bold w-full focus:outline-none focus:border-violet-600 tabular-nums';

  return (
    <div className="flex flex-col gap-5">
      {/* Section label */}
      <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Игра</div>

      {/* Financial fields */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Взнос (RSD)', val: buyIn, set: setBuyIn },
          { label: 'Начальный стек', val: initialStack, set: setInitialStack },
          { label: 'Ребай (RSD)', val: rebuyCost, set: setRebuyCost },
          { label: 'Фишек за ребай', val: rebuyChips, set: setRebuyChips },
          { label: 'Аддон (RSD)', val: addonCost, set: setAddonCost },
          { label: 'Фишек за аддон', val: addonChips, set: setAddonChips },
        ].map(({ label, val, set }) => (
          <div key={label} className="bg-[#242424] rounded-lg p-3">
            <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-2">{label}</label>
            <input type="number" min="0" value={val} onChange={e => set(e.target.value)} className={numInput} />
          </div>
        ))}
      </div>

      {/* Prize config */}
      <div className="bg-[#242424] rounded-lg p-4">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-3">Призовые места</div>
        <PrizeConfig
          spots={prizeSpots}
          pcts={prizePcts}
          onSpotsChange={setPrizeSpots}
          onPctsChange={setPrizePcts}
        />
      </div>

      {/* Player selection */}
      <div className="bg-[#242424] rounded-lg p-4">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-3">
          Кто играет сегодня ({selectedPlayerIds.size} выбрано)
        </div>
        {players.length === 0 ? (
          <p className="text-[#555] text-[13px]">Добавьте игроков во вкладке «Игроки»</p>
        ) : (
          <div className="flex flex-col gap-2">
            {players.map(player => (
              <label key={player.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPlayerIds.has(player.id)}
                  onChange={() => togglePlayer(player.id)}
                  className="w-4 h-4 accent-violet-600 cursor-pointer"
                />
                <span className="text-[14px] text-[#ccc]">{player.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={starting || selectedPlayerIds.size < 2}
        className="bg-green-700 text-white border-none rounded-lg py-3 text-[15px] font-semibold cursor-pointer hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {starting ? 'Запускаем...' : '▶ Начать игру'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/SessionSetup/
git commit -m "feat: SessionSetup and PrizeConfig components"
```

---

### Task 12: PrizeSummary + PlayerRow

**Files:**
- Create: `components/GamePanel/PrizeSummary.tsx`
- Create: `components/GamePanel/PlayerRow.tsx`

- [ ] **Step 1: Create PrizeSummary**

```typescript
// components/GamePanel/PrizeSummary.tsx
'use client';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';

export function PrizeSummary() {
  const { activeSession, sessionPlayers } = useGame();
  if (!activeSession) return null;

  const stats = calcGameStats(activeSession, sessionPlayers);

  return (
    <div className="flex flex-col gap-1">
      {stats.payouts.map((amount, i) => (
        <div key={i} className="flex justify-between items-center text-[13px]">
          <span className="text-[#666]">{i + 1}-е место ({activeSession.prizePcts[i]}%)</span>
          <span className="text-[#ccc] font-bold tabular-nums">{amount.toLocaleString('ru')} ₽</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create PlayerRow**

```typescript
// components/GamePanel/PlayerRow.tsx
'use client';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { Avatar } from '../PlayerManager/PlayerManager';
import type { SessionPlayer } from '@/types/game';

type Props = { sp: SessionPlayer };

export function PlayerRow({ sp }: Props) {
  const { players, activeSession, doRebuy, doAddon, eliminatePlayer, declareWinner, sessionPlayers } = useGame();
  const [confirming, setConfirming] = useState(false);
  const player = players.find(p => p.id === sp.playerId);
  if (!player || !activeSession) return null;

  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const isLastPlayer = activePlayers.length === 1 && sp.status === 'playing';

  if (sp.status === 'eliminated' || sp.status === 'winner') {
    return (
      <div className="flex items-center gap-3 py-2 opacity-50">
        <Avatar player={player} size={32} />
        <span className="flex-1 text-[13px] text-[#666] line-through">{player.name}</span>
        <span className="text-[11px] text-[#444]">{sp.finishPosition}-е</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2 border-b border-[#242424] last:border-0">
      <div className="flex items-center gap-3">
        <Avatar player={player} size={36} />
        <span
          className="flex-1 text-[14px] text-[#ccc] cursor-pointer hover:text-white"
          onClick={() => !isLastPlayer && setConfirming(c => !c)}
        >
          {player.name}
        </span>
        {activeSession.rebuyCost > 0 && (
          <button
            onClick={() => doRebuy(sp.id)}
            className="text-[11px] bg-[#2a2040] border border-[#443366] text-violet-400 rounded px-2 py-1 cursor-pointer hover:bg-[#3a2060]"
          >
            Ребай{sp.rebuys > 0 ? ` ×${sp.rebuys}` : ''}
          </button>
        )}
        {activeSession.addonCost > 0 && (
          <button
            onClick={() => !sp.hasAddon && doAddon(sp.id)}
            disabled={sp.hasAddon}
            className={`text-[11px] rounded px-2 py-1 cursor-pointer border ${
              sp.hasAddon
                ? 'bg-transparent border-[#333] text-[#444] cursor-not-allowed'
                : 'bg-[#1a2a1a] border-[#336633] text-green-400 hover:bg-[#2a3a2a]'
            }`}
          >
            {sp.hasAddon ? 'Аддон ✓' : 'Аддон'}
          </button>
        )}
      </div>

      {confirming && !isLastPlayer && (
        <div className="flex items-center gap-2 pl-[48px]">
          <span className="text-[12px] text-[#888]">Вылетел?</span>
          <button
            onClick={async () => { await eliminatePlayer(sp.id); setConfirming(false); }}
            className="text-[12px] bg-red-900 border border-red-700 text-red-300 rounded px-3 py-1 cursor-pointer hover:bg-red-800"
          >
            Да, вылетел
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-[12px] bg-transparent border border-[#333] text-[#666] rounded px-3 py-1 cursor-pointer"
          >
            Отмена
          </button>
        </div>
      )}

      {isLastPlayer && (
        <div className="pl-[48px]">
          <button
            onClick={() => declareWinner(sp.id)}
            className="text-[13px] bg-yellow-900 border border-yellow-600 text-yellow-300 rounded-lg px-4 py-2 cursor-pointer hover:bg-yellow-800 font-semibold"
          >
            🏆 Объявить победителем
          </button>
        </div>
      )}
    </div>
  );
}
```


- [ ] **Step 3: Commit**

```bash
git add components/GamePanel/PrizeSummary.tsx components/GamePanel/PlayerRow.tsx
git commit -m "feat: PrizeSummary and PlayerRow components"
```

---

### Task 13: GamePanel

**Files:**
- Create: `components/GamePanel/GamePanel.tsx`

- [ ] **Step 1: Create GamePanel**

```typescript
// components/GamePanel/GamePanel.tsx
'use client';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';
import { PlayerRow } from './PlayerRow';
import { PrizeSummary } from './PrizeSummary';

type Props = { onClose: () => void };

export function GamePanel({ onClose }: Props) {
  const { activeSession, sessionPlayers } = useGame();
  if (!activeSession) return null;

  const stats = calcGameStats(activeSession, sessionPlayers);
  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const eliminatedPlayers = sessionPlayers
    .filter(p => p.status === 'eliminated' || p.status === 'winner')
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[320px] z-40 bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Игра</div>
            <div className="text-[18px] font-bold text-[#ccc] tabular-nums mt-0.5">
              {stats.bank.toLocaleString('ru')} ₽
            </div>
          </div>
          <button onClick={onClose} className="text-[#555] text-[20px] bg-transparent border-none cursor-pointer hover:text-[#999] leading-none">✕</button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-px bg-[#2a2a2a] border-b border-[#2a2a2a] shrink-0">
          {[
            { label: 'Фишек в игре', value: stats.totalChips.toLocaleString('ru') },
            { label: 'Средний стек', value: stats.avgStack.toLocaleString('ru') },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1a1a1a] px-4 py-2">
              <div className="text-[10px] text-[#555] uppercase tracking-[1px]">{label}</div>
              <div className="text-[15px] font-bold text-[#888] tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Active players */}
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">
              В игре ({activePlayers.length})
            </div>
            {activePlayers.map(sp => <PlayerRow key={sp.id} sp={sp} />)}
          </div>

          {/* Eliminated */}
          {eliminatedPlayers.length > 0 && (
            <div>
              <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">
                Вылетели ({eliminatedPlayers.length})
              </div>
              {eliminatedPlayers.map(sp => <PlayerRow key={sp.id} sp={sp} />)}
            </div>
          )}

          {/* Prize breakdown */}
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">Призовые</div>
            <PrizeSummary />
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep -v __tests__
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/GamePanel/GamePanel.tsx
git commit -m "feat: GamePanel slide-in with stats, player list, prizes"
```

---

### Task 14: WinnerScreen

**Files:**
- Create: `components/WinnerScreen/WinnerScreen.tsx`

- [ ] **Step 1: Create WinnerScreen**

```typescript
// components/WinnerScreen/WinnerScreen.tsx
'use client';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';
import { Avatar } from '../PlayerManager/PlayerManager';

export function WinnerScreen() {
  const { activeSession, sessionPlayers, players, finishGame } = useGame();
  if (!activeSession) return null;

  const winner = sessionPlayers.find(sp => sp.status === 'winner');
  const winnerPlayer = winner ? players.find(p => p.id === winner.playerId) : null;
  const stats = calcGameStats(activeSession, sessionPlayers);

  const runnerUps = sessionPlayers
    .filter(sp => sp.status === 'eliminated' && (sp.finishPosition ?? 99) <= activeSession.prizeSpots)
    .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0d] overflow-hidden">
      {/* CSS confetti */}
      <ConfettiLayer />

      <div className="flex flex-col items-center gap-6 text-center px-8 relative z-10">
        <div className="text-[48px]">🏆</div>

        {winnerPlayer && (
          <div className="flex flex-col items-center gap-3">
            <Avatar player={winnerPlayer} size={160} />
            <h1 className="text-[32px] font-black text-white uppercase tracking-[2px]">
              {winnerPlayer.name}
            </h1>
            <div className="text-[16px] text-violet-400 tracking-[4px] uppercase font-semibold">
              Победитель
            </div>
          </div>
        )}

        <div className="text-[36px] font-black text-yellow-400 tabular-nums">
          {stats.payouts[0]?.toLocaleString('ru')} ₽
        </div>

        {runnerUps.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {runnerUps.map(sp => {
              const p = players.find(pl => pl.id === sp.playerId);
              const payout = stats.payouts[(sp.finishPosition ?? 2) - 1];
              if (!p || !payout) return null;
              return (
                <div key={sp.id} className="text-[#666] text-[14px]">
                  {sp.finishPosition}-е место: {p.name} — {payout.toLocaleString('ru')} ₽
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={finishGame}
          className="mt-4 bg-[#1e1e1e] border border-[#333] text-[#888] rounded-xl px-8 py-3 text-[15px] cursor-pointer hover:border-[#555] hover:text-[#ccc] transition-colors"
        >
          Завершить игру
        </button>
      </div>
    </div>
  );
}

function ConfettiLayer() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  const colors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#db2777'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.3; }
        }
      `}</style>
      {pieces.map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-20px',
            left: `${(i / pieces.length) * 100}%`,
            width: i % 3 === 0 ? '10px' : '8px',
            height: i % 3 === 0 ? '10px' : '16px',
            backgroundColor: colors[i % colors.length],
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            animation: `confetti-fall ${2.5 + (i % 5) * 0.4}s ${(i % 7) * 0.25}s ease-in infinite`,
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/WinnerScreen/WinnerScreen.tsx
git commit -m "feat: WinnerScreen with CSS confetti, payouts, runner-up list"
```

---

### Task 15: Full TypeScript check + version bump

**Files:**
- Modify: `components/SettingsScreen.tsx` — version `4.1` → `4.2`
- Modify: `CLAUDE.md` — version `4.1` → `4.2`

- [ ] **Step 1: Full TypeScript check**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep -v __tests__
```

Fix any errors before proceeding.

- [ ] **Step 2: Run existing tests**

```bash
/opt/homebrew/bin/node node_modules/.bin/jest 2>&1 | tail -20
```

Expected: all existing tests pass, new game tests pass.

- [ ] **Step 3: Bump version to 4.2 in SettingsScreen.tsx**

In `components/SettingsScreen.tsx`, the version display already shows `v4.2` per the CHANGELOG written in Task 8. Verify the version display line reads:
```typescript
<div className="text-[11px] text-[#444] mt-[2px] cursor-pointer" onClick={() => setShowChangelog(true)}>v4.2</div>
```

- [ ] **Step 4: Update CLAUDE.md**

In `CLAUDE.md`, change:
```
Текущая версия: **4.1**
```
to:
```
Текущая версия: **4.2**
```

- [ ] **Step 5: Final commit + push**

```bash
git add -A
git commit -m "feat: game tracking system v4.2 — players, sessions, live tracking, winner screen"
git push origin main
```

---

### Task 16: Close backlog issue

- [ ] **Step 1: Close issue #43**

```bash
~/bin/gh issue close 43 --repo bon2362/poker-timer
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | `types/game.ts` — all game types |
| 2 | Supabase DB tables + RLS + storage bucket |
| 3 | Supabase lib functions (players, sessions, storage) |
| 4 | `lib/game.ts` — pure calculations, 6 tests |
| 5 | `context/GameContext.tsx` — full game state + actions |
| 6 | `context/TimerContext.tsx` — timer state extracted |
| 7 | Providers wired in layout, PokerTimer refactored |
| 8 | SettingsScreen 3-tab structure |
| 9 | PlayerManager + PlayerForm |
| 10 | AvatarCropper (Canvas API) |
| 11 | SessionSetup + PrizeConfig |
| 12 | PrizeSummary + PlayerRow |
| 13 | GamePanel |
| 14 | WinnerScreen + CSS confetti |
| 15 | TS check + version bump 4.2 |
| 16 | Close issue #43 |
