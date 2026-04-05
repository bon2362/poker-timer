# Poker Timer — Next.js Migration Design Spec
**Date:** 2026-04-05
**Issue:** #2

## Context

Перенос существующего `poker-timer.html` (v3.19) на Next.js + Supabase. Цель — сохранить всю текущую функциональность (таймер, настройки, аудио) и заложить инфраструктуру для будущих фич: realtime-управление с телефона (#5), admin-раздел (#42), сетка игроков (#43).

Текущее состояние: single-file HTML, без зависимостей, Vercel деплой, localStorage для настроек.

---

## Архитектура

**Стек:** Next.js App Router, TypeScript, Tailwind CSS, Supabase (Realtime Broadcast).

**Модель:** ноутбук — хост, он владеет состоянием таймера и транслирует снапшоты в Supabase-канал. Телефоны читают канал (задача #5). Серверные компоненты не используются — таймер целиком `'use client'`.

---

## Структура файлов

```
app/
  layout.tsx              — корневой layout, тёмный фон, шрифты
  page.tsx                — импортирует PokerTimer, без логики

components/
  PokerTimer.tsx          — 'use client', useReducer, оркестрирует всё
  TimerDisplay.tsx        — большая цифра + progress bar
  Controls.tsx            — кнопки ⏮⏪▶⏩⏭
  BlindInfo.tsx           — верхняя строка (Round N, SB/BB или ☕ Break)
  NextInfo.tsx            — нижняя строка "Next: ..."
  SettingsScreen.tsx      — полный экран настроек

lib/
  timer.ts                — buildStages(), formatTime(), getNextInfo()
  audio.ts                — playBeep() через Web Audio API
  storage.ts              — loadConfig(), saveConfig() через localStorage

types/
  timer.ts                — Stage, Config, TimerState, Action

supabase/
  client.ts               — createClient() singleton + getTimerChannel()

public/
  audio/                  — MP3-файлы голосовых фраз (из Base64 в файлы)
```

---

## Управление состоянием

`useReducer` в `PokerTimer.tsx`. Единственный источник истины.

### TimerState

```typescript
type TimerState = {
  stages: Stage[];
  currentStage: number;
  timeLeft: number;
  isPaused: boolean;
  isOver: boolean;
  warnedOneMin: boolean;
  config: Config;
  screen: 'timer' | 'settings';
}
```

### Actions

```typescript
type Action =
  | { type: 'TICK' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'NEXT_STAGE' }
  | { type: 'PREV_STAGE' }
  | { type: 'RESET_STAGE' }
  | { type: 'GO_TO_LAST' }
  | { type: 'RESTART' }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; config: Config }
  | { type: 'CLOSE_SETTINGS' }
```

`setInterval` — в `useEffect`, диспатчит `TICK` каждую секунду. Побочные эффекты (звук, Supabase broadcast) — в отдельных `useEffect` реагирующих на state.

Начальное состояние инициализируется lazy-функцией в `useReducer`, которая вызывает `loadConfig()` из localStorage.

---

## Компоненты

### PokerTimer
`'use client'`. Держит `useReducer`, управляет `setInterval`, открывает Supabase-канал. Рендерит `<SettingsScreen>` при `screen === 'settings'`, иначе — основной экран.

### BlindInfo
Props: `stage: Stage`, `isBreak: boolean`.
Отображает `Round N · SB / BB` или `☕ Break`.

### TimerDisplay
Props: `timeLeft`, `totalDuration`, `isPaused`, `isBreak`, `isWarning`, `isOvertime`.

Цвет таймера (через `cn()`):
- обычный → `text-white`
- перерыв → `text-blue-400`, progress → `bg-blue-600`
- предупреждение (последняя минута) → `text-orange-400`, фон `bg-[#3a1a0a]`
- overtime → `text-red-500`
- пауза → `opacity-25`

Размер: `text-[clamp(140px,22vw,240px)]` (Tailwind arbitrary value).

Progress bar: тонкая полоска 3px, заполнение = доля прошедшего времени.

### Controls
Props: `isPaused`, `isOver`, + колбэки `onTogglePause`, `onPrev`, `onNext`, `onReset`, `onGoLast`.
Кнопки: ⏮ ⏪ ▶/⏸ ⏩ ⏭. Фиолетовые (`bg-violet-700`) основные, тёмные (`bg-[#2a2a2a]`) ghost.

### NextInfo
Props: `stages`, `currentStage`.
Вызывает `getNextInfo()` из `lib/timer.ts`.

### SettingsScreen
Props: `config`, `onSave`, `onClose`, `onReset`.
Локальный `useState` для значений формы. Валидация при сабмите. При сохранении диспатчит `SAVE_SETTINGS` с новым config.
Идентична текущей SettingsScreen из `poker-timer.html` по функциональности.

---

## Библиотеки

### lib/timer.ts
Чистые функции, без side-эффектов:
- `buildStages(config: Config): Stage[]`
- `formatTime(seconds: number): string`
- `getNextInfo(stages: Stage[], currentStage: number): string`

### lib/audio.ts
`playBeep(count, freq?, duration?)` — Web Audio API, `AudioContext` как module-level синглтон. Идентично текущей реализации.

MP3 голосовые фразы: `new Audio('/audio/filename.mp3')` — файлы в `public/audio/`, Base64 из HTML больше не используется.

### lib/storage.ts
- `loadConfig(): Config` — читает `localStorage['pokerTimerConfig']`, fallback на `DEFAULT_CONFIG`
- `saveConfig(config: Config): void` — пишет в localStorage

---

## Supabase — Realtime Broadcast

Client-only, без серверных route handlers.

### supabase/client.ts
```typescript
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const getTimerChannel = (sessionId: string) =>
  supabase.channel(`timer:${sessionId}`)
```

### Broadcast в PokerTimer
```typescript
useEffect(() => {
  channel.send({
    type: 'broadcast',
    event: 'state',
    payload: { currentStage, timeLeft, isPaused }
  })
}, [currentStage, timeLeft, isPaused])
```

`sessionId` на этом этапе — значение из `NEXT_PUBLIC_SESSION_ID=main` (`.env.local`). В задаче #5 станет динамическим кодом сессии.

Входящие команды (управление с телефона) — задача #5, на этом этапе канал только исходящий.

Схема БД Supabase не нужна — используется только Realtime Broadcast (не таблицы). Таблицы появятся в задачах #4, #42, #43.

### ENV переменные
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SESSION_ID=main
```

---

## Что остаётся прежним

- Слепая структура (14 уровней, дефолты) — переносится без изменений
- Логика таймера (`tick`, `advanceStage`, все кнопки) — переносится без изменений
- Настройки в localStorage (`pokerTimerConfig`) — ключ и формат не меняются
- Визуальный дизайн — идентичен текущему (цвета, типографика, layout)
- Звуковые события (1 мин предупреждение, смена уровня, конец перерыва) — без изменений

---

## Out of Scope

- Управление с телефона / входящие команды → #5
- Admin-раздел с авторизацией → #42
- Сетка игроков → #43
- Сессии / восстановление после перезагрузки → #4
- Media Session API → #3
- Слайдшоу → #1
- Серверные компоненты, Route Handlers, база данных Supabase
