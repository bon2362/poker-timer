# Game Tracking — Design Spec
**Date:** 2026-04-05
**Status:** Approved
**Version:** 1.0

---

## Overview

Add a full poker game session tracking system to the existing timer app. Players are managed globally; sessions configure who plays and financial parameters; live tracking records rebuys, addons, and eliminations; the system auto-calculates the prize pool and payouts.

---

## 1. Architecture

### State Management
Two React Contexts wrap the entire application:

- **`TimerContext`** — refactored from existing `useReducer` in `PokerTimer.tsx`. Reads `hasActiveSession` from `GameContext` to decide whether the timer is unlocked.
- **`GameContext`** — new context owning all game state: player list, active session, session_players. Backed by Supabase.

```
app/layout.tsx
  └── GameProvider
        └── TimerProvider
              └── app/page.tsx → PokerTimer
```

### File Structure (new files)
```
context/
  GameContext.tsx          GameProvider + useGame()
  TimerContext.tsx          TimerProvider + useTimer() (refactor of existing)

lib/supabase/
  players.ts               CRUD: fetchPlayers, upsertPlayer, deletePlayer
  sessions.ts              CRUD: createSession, updateSession, fetchActiveSession
  storage.ts               uploadAvatar(playerId, blob) → url

types/
  game.ts                  Player, Session, SessionPlayer, SessionStatus, PlayerStatus

components/
  GamePanel/
    GamePanel.tsx           Slide-in side panel (~320px)
    PlayerRow.tsx           Single player row with rebuy/addon/eliminate actions
    PrizeSummary.tsx        Auto-calculated prize breakdown
  PlayerManager/
    PlayerManager.tsx       Player list for Settings → Игроки tab
    PlayerForm.tsx          Name input + avatar upload trigger
    AvatarCropper.tsx       Canvas-based circular crop tool
  SessionSetup/
    SessionSetup.tsx        Financial fields + player selection (Settings → Турнир)
    PrizeConfig.tsx         Prize spots count + percentage inputs with validation
  WinnerScreen/
    WinnerScreen.tsx        Full-screen overlay with confetti
```

---

## 2. Data Model

### Supabase Tables

```sql
players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
)

sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_in          integer NOT NULL,        -- RSD
  initial_stack   integer NOT NULL,        -- chips
  rebuy_cost      integer NOT NULL DEFAULT 0,
  rebuy_chips     integer NOT NULL DEFAULT 0,
  addon_cost      integer NOT NULL DEFAULT 0,
  addon_chips     integer NOT NULL DEFAULT 0,
  prize_spots     integer NOT NULL DEFAULT 1,
  prize_pcts      integer[] NOT NULL,      -- e.g. [50, 30, 20], must sum to 100
  status          text NOT NULL DEFAULT 'setup',  -- 'setup' | 'active' | 'finished'
  created_at      timestamptz DEFAULT now()
)

session_players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES sessions(id),
  player_id        uuid NOT NULL REFERENCES players(id),
  rebuys           integer NOT NULL DEFAULT 0,
  has_addon        boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'playing',  -- 'playing' | 'eliminated' | 'winner'
  finish_position  integer,   -- 1 = winner, 2 = runner-up, etc.
  eliminated_at    timestamptz
)
```

### Storage Bucket
- Name: `avatars`
- Access: public read
- Path pattern: `{player_id}.jpg`
- Format: JPEG, cropped to square, displayed as circle via CSS

### RLS
All policies open (anon read/write) for now. Auth to be added in a future iteration.

### TypeScript Types (`types/game.ts`)
```ts
type SessionStatus = 'setup' | 'active' | 'finished'
type PlayerStatus  = 'playing' | 'eliminated' | 'winner'

type Player = {
  id: string
  name: string
  avatarUrl: string | null
}

type Session = {
  id: string
  buyIn: number
  initialStack: number
  rebuyCost: number
  rebuyChips: number
  addonCost: number
  addonChips: number
  prizeSpots: number
  prizePcts: number[]
  status: SessionStatus
  createdAt: string
}

type SessionPlayer = {
  id: string
  sessionId: string
  playerId: string
  rebuys: number
  hasAddon: boolean
  status: PlayerStatus
  finishPosition: number | null
  eliminatedAt: string | null
}
```

---

## 3. Navigation & Screen Flow

### No Active Session
Timer screen is visible but blocked:
- Large semi-transparent overlay with message «Настройте игру перед стартом»
- Button «Открыть настройки» → opens Settings
- Timer controls and keyboard shortcuts disabled

### Settings — 3 Tabs
| Tab | Content |
|-----|---------|
| **Турнир** | Existing: blind levels table, time settings. New: financial config (buy-in, stack, rebuy, addon), prize config, player selection, «Начать игру» button |
| **Игроки** | Player CRUD list, avatar upload + crop tool |
| **Оформление** | Show combos toggle, sound test buttons |

### Active Session
- Overlay removed, timer fully functional
- New button 🂡 appears in top-right icon bar
- 🂡 opens/closes GamePanel slide-in from right

### GamePanel
- Width: ~320px, fixed on right, overlays timer (does not resize it)
- Sections: live stats → active players → eliminated players → prize breakdown → actions

---

## 4. Player Management

### Player List (Settings → Игроки)
- Shows all players with circular avatar (or initials on colored background if no avatar)
- «+ Добавить» button → inline form: name field + avatar upload button
- Each player row: click name to edit, ✕ to delete (confirmation required if player is in an active session)

### Avatar Cropper
Triggered when user selects a file. Opens modal with:
- **Drag area** — user drags the photo to reposition under the circle mask
- **Zoom slider** — range 50%–200%, default 100%
- **Live preview** — small circular preview thumbnail (48px) updates in real time
- **Controls** — [Отмена] [Сохранить]

Implementation: HTML5 Canvas API only, no external libraries.
On save: canvas exports to Blob (JPEG, quality 0.85) → uploaded to Supabase Storage → `avatar_url` saved to `players` table.

---

## 5. Session Setup (Settings → Турнир)

Existing timer settings (time + blinds) remain at top, unchanged.

New **ИГРА** section below:
- Buy-in (RSD), Initial stack (chips)
- Rebuy cost (RSD), Rebuy chips — if both 0, rebuy button hidden in GamePanel
- Addon cost (RSD), Addon chips — if both 0, addon button hidden in GamePanel

New **ПРИЗОВЫЕ МЕСТА** section:
- Spinner for number of spots (1–N, where N = number of selected players)
- Auto-generates percentage rows (pre-filled with common distributions: 1→100%, 2→65/35%, 3→50/30/20%)
- Validation: sum must equal exactly 100%, shown as live indicator
- Save is blocked if sum ≠ 100%

New **КТО ИГРАЕТ СЕГОДНЯ** section:
- Checkbox list of all players from `players` table
- Minimum 2 players required to start

**«Начать игру»** button (bottom of tab):
- Creates `session` record in Supabase with status `active`
- Creates `session_players` records for each selected player
- Sets `GameContext.activeSession`
- Redirects to timer screen (overlay disappears)

---

## 6. Live Tracking (GamePanel)

### Stats Bar
Recalculated on every action:
```
Bank     = (players × buyIn) + (totalRebuys × rebuyCost) + (totalAddons × addonCost)
Chips    = (players × initialStack) + (totalRebuys × rebuyChips) + (totalAddons × addonChips)
AvgStack = Chips / activePlayers
```

### Player Actions
- **[Ребай]** — increments `rebuys` counter for that player, updates stats instantly. Button shows count after first rebuy: «Ребай ×2»
- **[Аддон]** — sets `has_addon = true`, button becomes disabled with checkmark. Hidden if `addonCost === 0`
- **Tap player name** → confirmation: «Выбыл?» with place number pre-filled (e.g. 4th if 4 players remain). Confirms → status = `eliminated`, `finish_position` set, player moves to eliminated list

### Winner Flow
When 1 active player remains:
- «Отметить победителя» button becomes active
- Tap → sets that player `status = winner`, `finish_position = 1`
- WinnerScreen overlay appears immediately

### Prize Summary
Shown in GamePanel at all times:
```
Место  %    Сумма
1-е    50%  6 250 ₽
2-е    30%  3 750 ₽
3-е    20%  2 500 ₽
```
Updates live as bank grows.

---

## 7. Winner Screen

Full-screen overlay (z-50) over the timer:
- Dark background (#0d0d0d)
- CSS confetti animation (pure keyframes, no JS library)
- Large circular avatar (160px) or initials fallback
- Player name in large bold text
- «ПОБЕДИТЕЛЬ» subtitle
- Winning amount prominently displayed
- Other prize positions listed below (smaller)
- «Завершить игру» button → sets session `status = finished`, clears `GameContext.activeSession`, returns to blocked timer overlay

---

## 8. Calculations (Reference)

```
totalPlayers  = count of all session_players (paid buy-in at start, never changes)
totalRebuys   = sum of session_players.rebuys
totalAddons   = count of session_players where has_addon = true
activePlayers = count of session_players where status = 'playing'

bank    = (totalPlayers × buyIn) + (totalRebuys × rebuyCost) + (totalAddons × addonCost)
chips   = (totalPlayers × initialStack) + (totalRebuys × rebuyChips) + (totalAddons × addonChips)
avg     = floor(chips / activePlayers)

// Prize payouts — last spot absorbs rounding remainder so total always equals bank exactly
payout[i]    = floor(bank × prizePcts[i] / 100)   for i in 0..prizeSpots-2
payout[last] = bank - sum(payout[0..prizeSpots-2])
```

---

## 9. Mobile Version (Future Phase)

Deferred. Architecture is ready:
- `GameContext` accessible from any route
- Supabase backend works cross-device
- A separate `/mobile` route can render a simplified GamePanel-only view

---

## 10. Out of Scope (This Phase)

- Authentication / user accounts
- Tournament history / statistics across multiple sessions
- Real-time sync of game state between devices (Supabase Realtime for game events)
- Push notifications
- Multiple concurrent tournaments
