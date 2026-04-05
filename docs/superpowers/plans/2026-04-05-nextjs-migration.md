# Next.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести `poker-timer.html` (v3.19) на Next.js App Router + TypeScript + Tailwind + Supabase Realtime, сохранив всю текущую функциональность без регрессий.

**Architecture:** Ноутбук — хост; состояние таймера живёт в `useReducer` внутри `PokerTimer.tsx` и транслируется в Supabase Realtime Broadcast канал. Серверных компонентов нет — весь таймер `'use client'`. Компоненты декомпозированы, логика вынесена в чистые функции в `lib/`.

**Tech Stack:** Next.js 15 App Router, TypeScript 5, Tailwind CSS 3, Supabase JS v2, Jest + React Testing Library

---

## File Structure

```
app/
  layout.tsx              — корневой layout, тёмный bg, meta
  page.tsx                — рендерит <PokerTimer />
  globals.css             — @tailwind directives

components/
  PokerTimer.tsx          — 'use client', useReducer, setInterval, Supabase
  TimerDisplay.tsx        — большой таймер + progress bar
  BlindInfo.tsx           — верхняя строка (Round N + SB/BB + Next info)
  Controls.tsx            — кнопки ⏪ ▶/⏸ ⏩ + fullscreen + settings
  CombosPanel.tsx         — статическая таблица покерных комбинаций
  SettingsScreen.tsx      — экран настроек с формой

lib/
  timer.ts                — buildStages(), formatTime(), getNextInfo()
  audio.ts                — playSound(), playTick()
  storage.ts              — loadConfig(), saveConfig()

reducer/
  timerReducer.ts         — чистая функция редьюсера
  initialState.ts         — начальное состояние (lazy init)

types/
  timer.ts                — все TypeScript типы

supabase/
  client.ts               — singleton createClient + getTimerChannel

public/
  audio/
    warn-blinds.mp3
    blinds-up.mp3
    warn-break.mp3
    break-start.mp3
    warn-end-break.mp3
    break-over.mp3

__tests__/
  lib/timer.test.ts
  lib/storage.test.ts
  reducer/timerReducer.test.ts
```

---

## Task 1: Bootstrap — Next.js проект

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `app/globals.css`
- Modify: `vercel.json`

- [ ] **Шаг 1: Создать Next.js проект в текущей директории**

```bash
cd /Users/ekoshkin/poker
npx create-next-app@15 . --typescript --tailwind --app --no-src-dir --no-eslint --import-alias "@/*" --yes
```

Ожидаем: создаются `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `app/`, `public/`. Существующие файлы (`poker-timer.html`, `docs/`, `mp3/`) не затрагиваются.

- [ ] **Шаг 2: Установить Supabase**

```bash
npm install @supabase/supabase-js
```

- [ ] **Шаг 3: Установить Jest + React Testing Library**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Шаг 4: Создать `jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathPattern: '__tests__',
};

export default config;
```

- [ ] **Шаг 5: Создать `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Шаг 6: Добавить test script в `package.json`**

Открыть `package.json`, добавить в `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Шаг 7: Обновить `vercel.json`**

Заменить содержимое файла — текущие rewrites конфликтуют с Next.js роутингом:

```json
{}
```

- [ ] **Шаг 8: Обновить `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Шаг 9: Проверить что Next.js запускается**

```bash
npm run dev
```

Ожидаем: `http://localhost:3000` открывается, показывает дефолтную Next.js страницу. Ошибок компиляции нет.

- [ ] **Шаг 10: Коммит**

```bash
git add package.json package-lock.json next.config.ts tailwind.config.ts tsconfig.json jest.config.ts jest.setup.ts app/globals.css app/layout.tsx app/page.tsx vercel.json
git commit -m "chore: bootstrap Next.js 15 with TypeScript, Tailwind, Jest"
```

---

## Task 2: TypeScript типы

**Files:**
- Create: `types/timer.ts`

- [ ] **Шаг 1: Создать `types/timer.ts`**

```typescript
export type BlindLevel = {
  sb: number;
  bb: number;
};

export type Config = {
  levelDuration: number;   // минуты
  breakDuration: number;   // минуты
  breakEvery: number;
  showCombos: boolean;
  blindLevels: BlindLevel[];
};

export type LevelStage = {
  type: 'level';
  levelNum: number;
  sb: number;
  bb: number;
  duration: number;        // секунды
};

export type BreakStage = {
  type: 'break';
  duration: number;        // секунды
};

export type Stage = LevelStage | BreakStage;

export type SoundEvent =
  | 'warnBlinds'
  | 'blindsUp'
  | 'warnBreak'
  | 'breakStart'
  | 'warnEndBreak'
  | 'breakOver'
  | 'tick';

export type Screen = 'timer' | 'settings';

export type TimerState = {
  stages: Stage[];
  currentStage: number;
  timeLeft: number;        // секунды, может быть отрицательным (overtime)
  isPaused: boolean;
  isOver: boolean;
  warnedOneMin: boolean;
  config: Config;
  screen: Screen;
  pendingSound: SoundEvent | null;
};

export type Action =
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
  | { type: 'CLEAR_SOUND' };
```

- [ ] **Шаг 2: Коммит**

```bash
git add types/timer.ts
git commit -m "feat: TypeScript types for timer state"
```

---

## Task 3: lib/timer.ts (TDD)

**Files:**
- Create: `lib/timer.ts`
- Create: `__tests__/lib/timer.test.ts`

- [ ] **Шаг 1: Создать `__tests__/lib/timer.test.ts` с тестами**

```typescript
import { buildStages, formatTime, getNextInfo } from '@/lib/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import type { Config, Stage } from '@/types/timer';

describe('buildStages', () => {
  test('returns 20 stages for default config (14 levels + 6 breaks)', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages).toHaveLength(20);
  });

  test('first stage is level 1 with correct blinds', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[0]).toEqual({
      type: 'level',
      levelNum: 1,
      sb: 10,
      bb: 20,
      duration: 1200,
    });
  });

  test('break appears after every breakEvery levels', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    // Level 2 is at index 1, break is at index 2
    expect(stages[1].type).toBe('level');
    expect(stages[2].type).toBe('break');
  });

  test('no break after the last level', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    expect(stages[stages.length - 1].type).toBe('level');
  });

  test('break duration uses config.breakDuration', () => {
    const cfg: Config = { ...DEFAULT_CONFIG, breakDuration: 5 };
    const stages = buildStages(cfg);
    const breakStage = stages.find(s => s.type === 'break')!;
    expect(breakStage.duration).toBe(300);
  });

  test('level duration uses config.levelDuration', () => {
    const cfg: Config = { ...DEFAULT_CONFIG, levelDuration: 15 };
    const stages = buildStages(cfg);
    expect(stages[0].duration).toBe(900);
  });
});

describe('formatTime', () => {
  test('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  test('formats 1200 seconds as 20:00', () => {
    expect(formatTime(1200)).toBe('20:00');
  });

  test('formats 65 seconds as 01:05', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  test('formats negative seconds with minus sign (overtime)', () => {
    expect(formatTime(-5)).toBe('−00:05');
    expect(formatTime(-70)).toBe('−01:10');
  });
});

describe('getNextInfo', () => {
  const stages = buildStages(DEFAULT_CONFIG);

  test('returns next blind levels when next stage is a level', () => {
    // stage 2 (index 1) is level 2 (20/40), after break comes level 3
    // stage 0 is level 1, stage 1 is level 2 — next is break
    // Let's use a stage where next is a level: need to find one
    // After break (index 2) comes level 3 (index 3): so currentStage=2 → next is level
    const result = getNextInfo(stages, 2);
    expect(result).toBe('30 / 60');
  });

  test('returns break info when next stage is a break', () => {
    // currentStage=0 (level 1) → next is level 2 (index 1), not a break yet
    // currentStage=1 (level 2) → next is break (index 2)
    const result = getNextInfo(stages, 1);
    expect(result).toContain('Break');
    expect(result).toContain('30 / 60');
  });

  test('returns finale string when there is no next stage', () => {
    const result = getNextInfo(stages, stages.length - 1);
    expect(result).toBe('Tournament finale');
  });
});
```

- [ ] **Шаг 2: Запустить тесты — убедиться что все падают**

```bash
npx jest __tests__/lib/timer.test.ts --no-coverage
```

Ожидаем: ошибки `Cannot find module '@/lib/timer'` и `Cannot find module '@/lib/storage'`.

- [ ] **Шаг 3: Создать `lib/storage.ts` — только DEFAULT_CONFIG и типы (полная реализация в Task 4)**

```typescript
import type { Config } from '@/types/timer';

export const DEFAULT_CONFIG: Config = {
  levelDuration: 20,
  breakDuration: 10,
  breakEvery: 2,
  showCombos: true,
  blindLevels: [
    { sb: 10,  bb: 20   },
    { sb: 20,  bb: 40   },
    { sb: 30,  bb: 60   },
    { sb: 40,  bb: 80   },
    { sb: 60,  bb: 120  },
    { sb: 80,  bb: 160  },
    { sb: 100, bb: 200  },
    { sb: 150, bb: 300  },
    { sb: 200, bb: 400  },
    { sb: 300, bb: 600  },
    { sb: 400, bb: 800  },
    { sb: 600, bb: 1200 },
    { sb: 800, bb: 1600 },
    { sb: 1000, bb: 2000 },
  ],
};

export function loadConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(_config: Config): void {}
```

- [ ] **Шаг 4: Создать `lib/timer.ts`**

```typescript
import type { Config, Stage } from '@/types/timer';

export function buildStages(config: Config): Stage[] {
  const levelDuration = config.levelDuration * 60;
  const breakDuration = config.breakDuration * 60;
  const result: Stage[] = [];

  for (let i = 0; i < config.blindLevels.length; i++) {
    const levelNum = i + 1;
    result.push({
      type: 'level',
      levelNum,
      sb: config.blindLevels[i].sb,
      bb: config.blindLevels[i].bb,
      duration: levelDuration,
    });
    const isLast = levelNum === config.blindLevels.length;
    if (levelNum % config.breakEvery === 0 && !isLast) {
      result.push({ type: 'break', duration: breakDuration });
    }
  }

  return result;
}

export function formatTime(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return seconds < 0 ? `\u2212${str}` : str;  // U+2212 minus sign
}

export function getNextInfo(stages: Stage[], currentStage: number): string {
  const next = stages[currentStage + 1];
  if (!next) return 'Tournament finale';

  if (next.type === 'break') {
    const afterBreak = stages[currentStage + 2];
    const afterStr = afterBreak && afterBreak.type === 'level'
      ? ` → then ${afterBreak.sb} / ${afterBreak.bb}`
      : '';
    const breakStage = stages[currentStage + 1];
    const breakMin = breakStage.type === 'break'
      ? breakStage.duration / 60
      : 10;
    return `☕ Break ${breakMin} min${afterStr}`;
  }

  if (next.type === 'level') {
    return `${next.sb} / ${next.bb}`;
  }

  return '';
}
```

- [ ] **Шаг 5: Запустить тесты — убедиться что все проходят**

```bash
npx jest __tests__/lib/timer.test.ts --no-coverage
```

Ожидаем: `Tests: 10 passed`.

- [ ] **Шаг 6: Коммит**

```bash
git add lib/timer.ts lib/storage.ts __tests__/lib/timer.test.ts types/timer.ts
git commit -m "feat: timer pure functions with tests (buildStages, formatTime, getNextInfo)"
```

---

## Task 4: lib/storage.ts (TDD)

**Files:**
- Modify: `lib/storage.ts`
- Create: `__tests__/lib/storage.test.ts`

- [ ] **Шаг 1: Создать `__tests__/lib/storage.test.ts`**

```typescript
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '@/lib/storage';
import type { Config } from '@/types/timer';

const mockConfig: Config = {
  ...DEFAULT_CONFIG,
  levelDuration: 15,
  breakDuration: 5,
};

beforeEach(() => {
  localStorage.clear();
});

describe('loadConfig', () => {
  test('returns DEFAULT_CONFIG when localStorage is empty', () => {
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  test('returns parsed config when present in localStorage', () => {
    localStorage.setItem('pokerTimerConfig', JSON.stringify(mockConfig));
    const config = loadConfig();
    expect(config.levelDuration).toBe(15);
    expect(config.breakDuration).toBe(5);
  });

  test('returns DEFAULT_CONFIG on invalid JSON', () => {
    localStorage.setItem('pokerTimerConfig', 'not-json{{{');
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe('saveConfig', () => {
  test('writes config to localStorage', () => {
    saveConfig(mockConfig);
    const raw = localStorage.getItem('pokerTimerConfig');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.levelDuration).toBe(15);
  });

  test('overwrites previous config', () => {
    saveConfig(mockConfig);
    saveConfig({ ...mockConfig, levelDuration: 30 });
    const parsed = JSON.parse(localStorage.getItem('pokerTimerConfig')!);
    expect(parsed.levelDuration).toBe(30);
  });
});
```

- [ ] **Шаг 2: Запустить тесты — убедиться что часть падает**

```bash
npx jest __tests__/lib/storage.test.ts --no-coverage
```

Ожидаем: `loadConfig` тесты для localStorage падают, `saveConfig` тесты падают.

- [ ] **Шаг 3: Обновить `lib/storage.ts` — полная реализация**

```typescript
import type { Config } from '@/types/timer';

export const DEFAULT_CONFIG: Config = {
  levelDuration: 20,
  breakDuration: 10,
  breakEvery: 2,
  showCombos: true,
  blindLevels: [
    { sb: 10,  bb: 20   },
    { sb: 20,  bb: 40   },
    { sb: 30,  bb: 60   },
    { sb: 40,  bb: 80   },
    { sb: 60,  bb: 120  },
    { sb: 80,  bb: 160  },
    { sb: 100, bb: 200  },
    { sb: 150, bb: 300  },
    { sb: 200, bb: 400  },
    { sb: 300, bb: 600  },
    { sb: 400, bb: 800  },
    { sb: 600, bb: 1200 },
    { sb: 800, bb: 1600 },
    { sb: 1000, bb: 2000 },
  ],
};

export function loadConfig(): Config {
  try {
    const saved = localStorage.getItem('pokerTimerConfig');
    return saved ? (JSON.parse(saved) as Config) : structuredClone(DEFAULT_CONFIG);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: Config): void {
  localStorage.setItem('pokerTimerConfig', JSON.stringify(config));
}
```

- [ ] **Шаг 4: Запустить тесты**

```bash
npx jest __tests__/lib/storage.test.ts --no-coverage
```

Ожидаем: `Tests: 5 passed`.

- [ ] **Шаг 5: Коммит**

```bash
git add lib/storage.ts __tests__/lib/storage.test.ts
git commit -m "feat: localStorage config persistence with tests"
```

---

## Task 5: Редьюсер (TDD)

**Files:**
- Create: `reducer/initialState.ts`
- Create: `reducer/timerReducer.ts`
- Create: `__tests__/reducer/timerReducer.test.ts`

- [ ] **Шаг 1: Создать `reducer/initialState.ts`**

```typescript
import { buildStages } from '@/lib/timer';
import { loadConfig, DEFAULT_CONFIG } from '@/lib/storage';
import type { TimerState } from '@/types/timer';

export function createInitialState(): TimerState {
  const config = typeof window !== 'undefined' ? loadConfig() : structuredClone(DEFAULT_CONFIG);
  const stages = buildStages(config);
  return {
    stages,
    currentStage: 0,
    timeLeft: stages[0].duration,
    isPaused: true,
    isOver: false,
    warnedOneMin: false,
    config,
    screen: 'timer',
    pendingSound: null,
  };
}
```

- [ ] **Шаг 2: Создать `__tests__/reducer/timerReducer.test.ts`**

```typescript
import { timerReducer } from '@/reducer/timerReducer';
import { buildStages } from '@/lib/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import type { TimerState, Config } from '@/types/timer';

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  const config = DEFAULT_CONFIG;
  const stages = buildStages(config);
  return {
    stages,
    currentStage: 0,
    timeLeft: stages[0].duration,
    isPaused: true,
    isOver: false,
    warnedOneMin: false,
    config,
    screen: 'timer',
    pendingSound: null,
    ...overrides,
  };
}

describe('TICK', () => {
  test('does not decrement timeLeft when paused', () => {
    const state = makeState({ isPaused: true, timeLeft: 1200 });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(1200);
  });

  test('decrements timeLeft when running', () => {
    const state = makeState({ isPaused: false, timeLeft: 100 });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(99);
  });

  test('sets pendingSound and warnedOneMin at 61 seconds on level stage', () => {
    const state = makeState({ isPaused: false, timeLeft: 61, warnedOneMin: false });
    // stage 0 is level, stage 1 is level (no break yet for level 1)
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.warnedOneMin).toBe(true);
    expect(next.pendingSound).not.toBeNull();
  });

  test('does not set pendingSound again if warnedOneMin already true', () => {
    const state = makeState({ isPaused: false, timeLeft: 61, warnedOneMin: true });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.pendingSound).toBeNull();
  });

  test('advances to next stage when timeLeft reaches 0 (non-last stage)', () => {
    const state = makeState({ isPaused: false, timeLeft: 1, currentStage: 0 });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.currentStage).toBe(1);
    expect(next.timeLeft).toBe(next.stages[1].duration);
  });

  test('goes into overtime on last stage (timeLeft continues negative)', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const lastIdx = stages.length - 1;
    const state = makeState({ isPaused: false, timeLeft: 0, currentStage: lastIdx });
    const next = timerReducer(state, { type: 'TICK' });
    expect(next.timeLeft).toBe(-1);
    expect(next.isOver).toBe(false);
    expect(next.currentStage).toBe(lastIdx);
  });
});

describe('TOGGLE_PAUSE', () => {
  test('flips isPaused from true to false', () => {
    const state = makeState({ isPaused: true });
    const next = timerReducer(state, { type: 'TOGGLE_PAUSE' });
    expect(next.isPaused).toBe(false);
  });

  test('flips isPaused from false to true', () => {
    const state = makeState({ isPaused: false });
    const next = timerReducer(state, { type: 'TOGGLE_PAUSE' });
    expect(next.isPaused).toBe(true);
  });

  test('is no-op when isOver', () => {
    const state = makeState({ isOver: true, isPaused: true });
    const next = timerReducer(state, { type: 'TOGGLE_PAUSE' });
    expect(next.isPaused).toBe(true);
  });
});

describe('NEXT_STAGE', () => {
  test('increments currentStage and resets timeLeft', () => {
    const state = makeState({ currentStage: 0, timeLeft: 500 });
    const next = timerReducer(state, { type: 'NEXT_STAGE' });
    expect(next.currentStage).toBe(1);
    expect(next.timeLeft).toBe(next.stages[1].duration);
    expect(next.warnedOneMin).toBe(false);
  });

  test('does not exceed last stage', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const state = makeState({ currentStage: stages.length - 1 });
    const next = timerReducer(state, { type: 'NEXT_STAGE' });
    expect(next.currentStage).toBe(stages.length - 1);
  });
});

describe('PREV_STAGE', () => {
  test('decrements currentStage', () => {
    const state = makeState({ currentStage: 2 });
    const next = timerReducer(state, { type: 'PREV_STAGE' });
    expect(next.currentStage).toBe(1);
  });

  test('is no-op at stage 0', () => {
    const state = makeState({ currentStage: 0 });
    const next = timerReducer(state, { type: 'PREV_STAGE' });
    expect(next.currentStage).toBe(0);
  });
});

describe('RESET_STAGE', () => {
  test('resets timeLeft to current stage duration', () => {
    const state = makeState({ currentStage: 0, timeLeft: 100 });
    const next = timerReducer(state, { type: 'RESET_STAGE' });
    expect(next.timeLeft).toBe(state.stages[0].duration);
    expect(next.warnedOneMin).toBe(false);
  });
});

describe('GO_TO_LAST', () => {
  test('goes to the last stage', () => {
    const stages = buildStages(DEFAULT_CONFIG);
    const state = makeState({ currentStage: 0 });
    const next = timerReducer(state, { type: 'GO_TO_LAST' });
    expect(next.currentStage).toBe(stages.length - 1);
  });
});

describe('RESTART', () => {
  test('resets to initial state', () => {
    const state = makeState({ currentStage: 5, timeLeft: 42, isPaused: false, isOver: true });
    const next = timerReducer(state, { type: 'RESTART' });
    expect(next.currentStage).toBe(0);
    expect(next.timeLeft).toBe(next.stages[0].duration);
    expect(next.isPaused).toBe(true);
    expect(next.isOver).toBe(false);
  });
});

describe('OPEN_SETTINGS / CLOSE_SETTINGS', () => {
  test('OPEN_SETTINGS sets screen to settings and pauses', () => {
    const state = makeState({ screen: 'timer', isPaused: false });
    const next = timerReducer(state, { type: 'OPEN_SETTINGS' });
    expect(next.screen).toBe('settings');
    expect(next.isPaused).toBe(true);
  });

  test('CLOSE_SETTINGS sets screen to timer', () => {
    const state = makeState({ screen: 'settings' });
    const next = timerReducer(state, { type: 'CLOSE_SETTINGS' });
    expect(next.screen).toBe('timer');
  });
});

describe('SAVE_SETTINGS', () => {
  test('updates config and rebuilds stages', () => {
    const state = makeState();
    const newConfig: Config = { ...DEFAULT_CONFIG, levelDuration: 15 };
    const next = timerReducer(state, { type: 'SAVE_SETTINGS', config: newConfig });
    expect(next.config.levelDuration).toBe(15);
    expect(next.stages[0].duration).toBe(900);
    expect(next.currentStage).toBe(0);
    expect(next.screen).toBe('timer');
  });
});

describe('CLEAR_SOUND', () => {
  test('clears pendingSound', () => {
    const state = makeState({ pendingSound: 'blindsUp' });
    const next = timerReducer(state, { type: 'CLEAR_SOUND' });
    expect(next.pendingSound).toBeNull();
  });
});
```

- [ ] **Шаг 3: Запустить тесты — убедиться что все падают**

```bash
npx jest __tests__/reducer/timerReducer.test.ts --no-coverage
```

Ожидаем: `Cannot find module '@/reducer/timerReducer'`.

- [ ] **Шаг 4: Создать `reducer/timerReducer.ts`**

```typescript
import { buildStages } from '@/lib/timer';
import { saveConfig } from '@/lib/storage';
import type { TimerState, Action, SoundEvent } from '@/types/timer';

export function timerReducer(state: TimerState, action: Action): TimerState {
  switch (action.type) {
    case 'TICK': {
      if (state.isPaused) return state;

      const isLastStage = state.currentStage === state.stages.length - 1;

      // Overtime: last stage, timer continues negative
      if (isLastStage && state.timeLeft <= 0) {
        return { ...state, timeLeft: state.timeLeft - 1, pendingSound: null };
      }

      // 1-minute warning
      let pendingSound: SoundEvent | null = null;
      let warnedOneMin = state.warnedOneMin;
      if (state.timeLeft === 61 && !state.warnedOneMin) {
        warnedOneMin = true;
        const cur = state.stages[state.currentStage];
        const nxt = state.stages[state.currentStage + 1];
        if (cur.type === 'level') {
          pendingSound = nxt?.type === 'break' ? 'warnBreak' : 'warnBlinds';
        } else if (cur.type === 'break') {
          pendingSound = 'warnEndBreak';
        }
      }

      const newTimeLeft = state.timeLeft - 1;

      // Tick sound in last 5 seconds (handled in component via pendingSound)
      if (newTimeLeft <= 5 && newTimeLeft > 0 && !pendingSound) {
        pendingSound = 'tick';
      }

      if (newTimeLeft <= 0) {
        if (isLastStage) {
          // First tick into overtime: play blindsUp sound
          return {
            ...state,
            timeLeft: newTimeLeft,
            warnedOneMin,
            pendingSound: 'blindsUp',
          };
        }
        // Advance to next stage
        return advanceStage({ ...state, warnedOneMin, pendingSound });
      }

      return { ...state, timeLeft: newTimeLeft, warnedOneMin, pendingSound };
    }

    case 'TOGGLE_PAUSE': {
      if (state.isOver) return state;
      return { ...state, isPaused: !state.isPaused };
    }

    case 'NEXT_STAGE': {
      if (state.currentStage >= state.stages.length - 1) return state;
      const next = state.currentStage + 1;
      return {
        ...state,
        currentStage: next,
        timeLeft: state.stages[next].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'PREV_STAGE': {
      if (state.currentStage <= 0) return state;
      const prev = state.currentStage - 1;
      return {
        ...state,
        currentStage: prev,
        timeLeft: state.stages[prev].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'RESET_STAGE': {
      return {
        ...state,
        timeLeft: state.stages[state.currentStage].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'GO_TO_LAST': {
      const last = state.stages.length - 1;
      return {
        ...state,
        currentStage: last,
        timeLeft: state.stages[last].duration,
        warnedOneMin: false,
        pendingSound: null,
      };
    }

    case 'RESTART': {
      return {
        ...state,
        currentStage: 0,
        timeLeft: state.stages[0].duration,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        pendingSound: null,
        screen: 'timer',
      };
    }

    case 'OPEN_SETTINGS': {
      return { ...state, screen: 'settings', isPaused: true };
    }

    case 'CLOSE_SETTINGS': {
      return { ...state, screen: 'timer' };
    }

    case 'SAVE_SETTINGS': {
      saveConfig(action.config);
      const stages = buildStages(action.config);
      return {
        ...state,
        config: action.config,
        stages,
        currentStage: 0,
        timeLeft: stages[0].duration,
        isPaused: true,
        isOver: false,
        warnedOneMin: false,
        pendingSound: null,
        screen: 'timer',
      };
    }

    case 'CLEAR_SOUND': {
      return { ...state, pendingSound: null };
    }

    default:
      return state;
  }
}

function advanceStage(state: TimerState): TimerState {
  const nextIdx = state.currentStage + 1;
  const wasBreak = state.stages[state.currentStage].type === 'break';
  const nextStage = state.stages[nextIdx];

  let pendingSound: SoundEvent;
  if (nextStage.type === 'break') {
    pendingSound = 'breakStart';
  } else if (wasBreak) {
    pendingSound = 'breakOver';
  } else {
    pendingSound = 'blindsUp';
  }

  return {
    ...state,
    currentStage: nextIdx,
    timeLeft: nextStage.duration,
    warnedOneMin: false,
    pendingSound,
  };
}
```

- [ ] **Шаг 5: Запустить тесты**

```bash
npx jest __tests__/reducer/timerReducer.test.ts --no-coverage
```

Ожидаем: все тесты зелёные.

- [ ] **Шаг 6: Коммит**

```bash
git add reducer/timerReducer.ts reducer/initialState.ts __tests__/reducer/timerReducer.test.ts
git commit -m "feat: timer reducer with full action handling and tests"
```

---

## Task 6: lib/audio.ts + MP3 файлы

**Files:**
- Create: `lib/audio.ts`
- Move: `mp3/*.mp3` → `public/audio/*.mp3`

- [ ] **Шаг 1: Скопировать MP3 файлы в `public/audio/` с новыми именами**

```bash
mkdir -p public/audio
cp "mp3/One minute until blinds go up.mp3"  public/audio/warn-blinds.mp3
cp "mp3/Blinds are going up.mp3"             public/audio/blinds-up.mp3
cp "mp3/One minute until the break.mp3"      public/audio/warn-break.mp3
cp "mp3/Break time. Take a rest.mp3"         public/audio/break-start.mp3
cp "mp3/One minute until end of break.mp3"   public/audio/warn-end-break.mp3
cp "mp3/Break's over, let's play.mp3"        public/audio/break-over.mp3
```

Ожидаем: 6 файлов в `public/audio/`.

- [ ] **Шаг 2: Создать `lib/audio.ts`**

```typescript
import type { SoundEvent } from '@/types/timer';

const SOUND_FILES: Record<Exclude<SoundEvent, 'tick'>, string> = {
  warnBlinds:   '/audio/warn-blinds.mp3',
  blindsUp:     '/audio/blinds-up.mp3',
  warnBreak:    '/audio/warn-break.mp3',
  breakStart:   '/audio/break-start.mp3',
  warnEndBreak: '/audio/warn-end-break.mp3',
  breakOver:    '/audio/break-over.mp3',
};

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playSound(event: SoundEvent): void {
  if (event === 'tick') {
    playTick();
    return;
  }
  const src = SOUND_FILES[event];
  const audio = new Audio(src);
  audio.play().catch(() => {});
}

export function playTick(): void {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 1000;
    const start = ctx.currentTime;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    osc.start(start);
    osc.stop(start + 0.08);
  } catch {}
}
```

- [ ] **Шаг 3: Проверить в браузере**

Открыть `http://localhost:3000` → DevTools Console → выполнить:

```js
// import не работает в консоли, но можно вызвать через временный тест
// Достаточно убедиться что файлы доступны:
fetch('/audio/warn-blinds.mp3').then(r => console.log(r.status))
```

Ожидаем: `200`.

- [ ] **Шаг 4: Коммит**

```bash
git add lib/audio.ts public/audio/
git commit -m "feat: audio module with voice MP3 files and tick beep"
```

---

## Task 7: Supabase client + ENV

**Files:**
- Create: `supabase/client.ts`
- Create: `.env.local`

- [ ] **Шаг 1: Создать `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SESSION_ID=main
```

Заполнить реальными значениями из Supabase Dashboard → Project Settings → API.

Если проекта в Supabase ещё нет — создать: https://supabase.com → New project.

- [ ] **Шаг 2: Убедиться что `.env.local` в `.gitignore`**

```bash
grep '.env.local' .gitignore
```

Если строки нет — добавить:
```bash
echo '.env.local' >> .gitignore
```

- [ ] **Шаг 3: Создать `supabase/client.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export function getTimerChannel(sessionId: string) {
  return supabase.channel(`timer:${sessionId}`);
}
```

- [ ] **Шаг 4: Коммит**

```bash
git add supabase/client.ts .gitignore
git commit -m "feat: Supabase client and timer broadcast channel"
```

---

## Task 8: BlindInfo компонент

**Files:**
- Create: `components/BlindInfo.tsx`

- [ ] **Шаг 1: Создать `components/BlindInfo.tsx`**

```tsx
import type { Stage } from '@/types/timer';

type Props = {
  stage: Stage;
  stages: Stage[];
  currentStage: number;
  breakDuration: number;
};

export function BlindInfo({ stage, stages, currentStage, breakDuration }: Props) {
  const next = stages[currentStage + 1];

  let nextText = '';
  if (!next) {
    nextText = 'Tournament finale';
  } else if (next.type === 'break') {
    const afterBreak = stages[currentStage + 2];
    const afterStr = afterBreak && afterBreak.type === 'level'
      ? ` → then ${afterBreak.sb} / ${afterBreak.bb}`
      : '';
    nextText = `☕ Break ${breakDuration} min${afterStr}`;
  } else if (next.type === 'level') {
    nextText = `${next.sb} / ${next.bb}`;
  }

  if (stage.type === 'level') {
    return (
      <div className="flex-1 text-center">
        <div className="text-[13px] text-[#888] tracking-[2px] uppercase mb-1">
          Round {stage.levelNum}
        </div>
        <div className="text-[46px] font-bold leading-tight">
          {stage.sb} / {stage.bb}
        </div>
        <div className="text-[14px] text-[#666] mt-1 tracking-[0.5px]">
          <strong className="text-[#888]">Next:</strong> {nextText}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-center">
      <div className="text-[13px] text-[#888] tracking-[2px] uppercase mb-1">
        ☕ Break
      </div>
      <div className="text-[46px] font-bold leading-tight text-blue-400">
        {breakDuration} min
      </div>
      <div className="text-[14px] text-[#666] mt-1 tracking-[0.5px]">
        <strong className="text-[#888]">Next:</strong> {nextText}
      </div>
    </div>
  );
}
```

- [ ] **Шаг 2: Коммит**

```bash
git add components/BlindInfo.tsx
git commit -m "feat: BlindInfo component"
```

---

## Task 9: TimerDisplay компонент

**Files:**
- Create: `components/TimerDisplay.tsx`

- [ ] **Шаг 1: Создать `components/TimerDisplay.tsx`**

```tsx
import { formatTime } from '@/lib/timer';
import type { Stage } from '@/types/timer';

type Props = {
  timeLeft: number;
  stage: Stage;
  isPaused: boolean;
};

export function TimerDisplay({ timeLeft, stage, isPaused }: Props) {
  const isBreak   = stage.type === 'break';
  const isOvertime = timeLeft < 0;
  const isWarning = timeLeft <= 60 && timeLeft >= 0 && !isBreak;

  const timerColor = isOvertime
    ? 'text-red-500'
    : isWarning
    ? 'text-orange-400'
    : isBreak
    ? 'text-blue-400'
    : 'text-white';

  const progressColor = isBreak
    ? 'bg-blue-600'
    : isWarning
    ? 'bg-orange-400'
    : 'bg-violet-700';

  const elapsed = stage.duration - timeLeft;
  const pct = Math.min(100, Math.max(0, (elapsed / stage.duration) * 100));

  return (
    <>
      <div className="flex-1 flex items-center justify-center relative">
        {isPaused && (
          <div
            className="absolute pointer-events-none select-none font-black text-white/[0.18]"
            style={{ fontSize: 'clamp(184px, 36vw, 357px)', letterSpacing: '0.15em' }}
          >
            PAUSE
          </div>
        )}
        <div
          className={`font-black leading-none tabular-nums tracking-[-4px] transition-opacity ${timerColor} ${isPaused ? 'opacity-25' : 'opacity-100'}`}
          style={{ fontSize: 'clamp(140px, 22vw, 240px)' }}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="pb-[6px]">
        <div className="h-[3px] bg-[#333]">
          <div
            className={`h-full transition-[width] duration-[900ms] linear ${progressColor} ${isOvertime ? 'w-full' : ''}`}
            style={isOvertime ? {} : { width: `${pct}%` }}
          />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Шаг 2: Коммит**

```bash
git add components/TimerDisplay.tsx
git commit -m "feat: TimerDisplay component with overtime and warning states"
```

---

## Task 10: Controls компонент

**Files:**
- Create: `components/Controls.tsx`

- [ ] **Шаг 1: Создать `components/Controls.tsx`**

```tsx
type Props = {
  isPaused: boolean;
  isOver: boolean;
  onPrev: () => void;
  onTogglePause: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
};

const btn = 'bg-violet-700 border-none text-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-violet-800';

export function Controls({
  isPaused,
  isOver,
  onPrev,
  onTogglePause,
  onNext,
  onOpenSettings,
  onToggleFullscreen,
}: Props) {
  return (
    <div className="px-7 pb-[18px] flex justify-center">
      <div className="flex gap-[10px] items-center">
        <button className={`${btn} w-11 h-[38px] text-[15px]`} onClick={onPrev} title="Previous level">
          ⏪
        </button>
        <button
          className={`${btn} w-[52px] h-[42px] text-[18px]`}
          onClick={onTogglePause}
          disabled={isOver}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
        <button className={`${btn} w-11 h-[38px] text-[15px]`} onClick={onNext} title="Next level">
          ⏩
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Шаг 2: Коммит**

```bash
git add components/Controls.tsx
git commit -m "feat: Controls component"
```

---

## Task 11: CombosPanel компонент

**Files:**
- Create: `components/CombosPanel.tsx`

- [ ] **Шаг 1: Создать `components/CombosPanel.tsx`**

```tsx
type CardProps = {
  rank: string;
  suit: string;
  red?: boolean;
  hidden?: boolean;
};

function Card({ rank, suit, red, hidden }: CardProps) {
  if (hidden) {
    return (
      <div className="w-[46px] h-[60px] rounded-[5px] flex flex-col items-center justify-center bg-[#1d1d1d] border border-[#242424] text-[#242424]">
        <span className="text-[13px] font-bold">{rank}</span>
        <span className="text-[18px]">{suit}</span>
      </div>
    );
  }
  return (
    <div className={`w-[46px] h-[60px] rounded-[5px] flex flex-col items-center justify-center bg-[#272727] border border-[#444] ${red ? 'text-[#c84040]' : 'text-[#bbb]'}`}>
      <span className="text-[13px] font-bold leading-[1.3]">{rank}</span>
      <span className="text-[18px] leading-[1.1]">{suit}</span>
    </div>
  );
}

function Row({ cards }: { cards: CardProps[] }) {
  return (
    <div className="flex gap-[5px]">
      {cards.map((c, i) => <Card key={i} {...c} />)}
    </div>
  );
}

type Props = {
  visible: boolean;
  onToggle: () => void;
};

export function CombosPanel({ visible, onToggle }: Props) {
  return (
    <div
      className="fixed right-[42px] top-1/2 -translate-y-1/2 z-10 cursor-pointer"
      onClick={onToggle}
    >
      <div className={`flex flex-col gap-[7px] ${visible ? 'visible' : 'invisible'}`}>
        <Row cards={[
          { rank: '10', suit: '♥', red: true }, { rank: 'J', suit: '♥', red: true },
          { rank: 'Q', suit: '♥', red: true },  { rank: 'K', suit: '♥', red: true },
          { rank: 'A', suit: '♥', red: true },
        ]} />
        <Row cards={[
          { rank: '7', suit: '♣' }, { rank: '8', suit: '♣' }, { rank: '9', suit: '♣' },
          { rank: '10', suit: '♣' }, { rank: 'J', suit: '♣' },
        ]} />
        <Row cards={[
          { rank: 'K', suit: '♠' }, { rank: 'K', suit: '♦', red: true },
          { rank: 'K', suit: '♣' }, { rank: 'K', suit: '♥', red: true },
          { rank: '3', suit: '♦', hidden: true },
        ]} />
        <Row cards={[
          { rank: '6', suit: '♠' }, { rank: '6', suit: '♦', red: true },
          { rank: '6', suit: '♣' }, { rank: '10', suit: '♠' }, { rank: '10', suit: '♥', red: true },
        ]} />
        <Row cards={[
          { rank: 'J', suit: '♠' }, { rank: '7', suit: '♠' }, { rank: 'A', suit: '♠' },
          { rank: '4', suit: '♠' }, { rank: '2', suit: '♠' },
        ]} />
        <Row cards={[
          { rank: '9', suit: '♠' }, { rank: '9', suit: '♦', red: true },
          { rank: '9', suit: '♣' }, { rank: '9', suit: '♥', red: true },
          { rank: 'K', suit: '♠', hidden: true },
        ]} />
        <Row cards={[
          { rank: 'Q', suit: '♠' }, { rank: 'Q', suit: '♦', red: true },
          { rank: 'Q', suit: '♣' }, { rank: '7', suit: '♦', red: true },
          { rank: '7', suit: '♠' },
        ]} />
        <Row cards={[
          { rank: 'J', suit: '♦', red: true }, { rank: '9', suit: '♦', red: true },
          { rank: '8', suit: '♣' }, { rank: '7', suit: '♣' }, { rank: '6', suit: '♠' },
        ]} />
        <Row cards={[
          { rank: 'A', suit: '♦', red: true }, { rank: 'K', suit: '♦', red: true, hidden: true },
          { rank: '4', suit: '♣' }, { rank: '4', suit: '♦', red: true, hidden: true },
          { rank: '2', suit: '♥', red: true },
        ]} />
      </div>
    </div>
  );
}
```

- [ ] **Шаг 2: Коммит**

```bash
git add components/CombosPanel.tsx
git commit -m "feat: CombosPanel component with poker hand rankings"
```

---

## Task 12: SettingsScreen компонент

**Files:**
- Create: `components/SettingsScreen.tsx`

- [ ] **Шаг 1: Создать `components/SettingsScreen.tsx`**

```tsx
'use client';
import { useState } from 'react';
import type { Config, BlindLevel } from '@/types/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';

type Props = {
  config: Config;
  onSave: (config: Config) => void;
  onClose: () => void;
};

type FormErrors = {
  levelDuration?: string;
  breakDuration?: string;
  breakEvery?: string;
  blinds?: string;
};

export function SettingsScreen({ config, onSave, onClose }: Props) {
  const [levelDuration, setLevelDuration] = useState(String(config.levelDuration));
  const [breakDuration, setBreakDuration] = useState(String(config.breakDuration));
  const [breakEvery, setBreakEvery] = useState(String(config.breakEvery));
  const [showCombos, setShowCombos] = useState(config.showCombos !== false);
  const [blinds, setBlinds] = useState<BlindLevel[]>(
    config.blindLevels.map(l => ({ sb: l.sb, bb: l.bb }))
  );
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

    const invalidBlind = blinds.some(b => !b.sb || b.sb <= 0 || !b.bb || b.bb <= 0);
    if (invalidBlind) errs.blinds = 'Все SB и BB должны быть положительными числами';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return null;

    return { levelDuration: ld, breakDuration: bd, breakEvery: be, showCombos, blindLevels: blinds };
  }

  function handleSave() {
    const cfg = validate();
    if (cfg) onSave(cfg);
  }

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

  function removeBlind(i: number) {
    setBlinds(prev => prev.filter((_, idx) => idx !== i));
  }

  function addBlind() {
    const last = blinds[blinds.length - 1];
    setBlinds(prev => [...prev, { sb: (last?.sb || 0) * 2, bb: (last?.bb || 0) * 2 }]);
  }

  const inputBase = 'bg-[#333] border border-[#444] rounded-[6px] text-white px-[10px] py-[6px] text-[18px] font-bold w-[72px] text-center focus:outline-none focus:border-violet-600';
  const blindInputBase = 'bg-[#242424] border border-[#333] rounded-[6px] text-white px-[10px] py-[6px] text-[15px] w-[90px] text-right tabular-nums focus:outline-none focus:border-violet-600 focus:bg-[#2a2a2a]';

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2a2a] shrink-0">
        <button className="text-violet-500 text-[14px] bg-none border-none cursor-pointer" onClick={onClose}>
          ← Назад
        </button>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-[#ccc] tracking-[1px]">НАСТРОЙКИ</h1>
          <div className="text-[11px] text-[#444] mt-[2px]">v3.20</div>
        </div>
        <button
          className="bg-violet-700 text-white border-none rounded-lg px-[18px] py-[7px] text-[14px] font-semibold cursor-pointer hover:bg-violet-800"
          onClick={handleSave}
        >
          Сохранить
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

        {/* Time section */}
        <div>
          <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Время</div>
          <div className="flex gap-3">
            {[
              { label: 'Длительность уровня', id: 'level', val: levelDuration, set: setLevelDuration, unit: 'мин', err: errors.levelDuration },
              { label: 'Перерыв', id: 'break', val: breakDuration, set: setBreakDuration, unit: 'мин', err: errors.breakDuration },
              { label: 'Перерыв каждые', id: 'every', val: breakEvery, set: setBreakEvery, unit: 'уровня', err: errors.breakEvery },
            ].map(({ label, id, val, set, unit, err }) => (
              <div key={id} className="flex-1 bg-[#242424] rounded-lg p-[12px_14px]">
                <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-[6px]">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="1" max="999"
                    value={val}
                    onChange={e => set(e.target.value)}
                    className={`${inputBase} ${err ? 'border-red-500' : ''}`}
                  />
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
            <button onClick={handleReset} className="bg-none border-none text-[#444] text-[12px] cursor-pointer underline hover:text-red-500">
              сбросить к умолчаниям
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['#', 'SB', 'BB', ''].map((h, i) => (
                  <th key={i} className="text-[#555] text-[11px] uppercase tracking-[1px] text-left px-2 pb-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blinds.map((level, i) => {
                const levelNum = i + 1;
                const showBreak = levelNum % breakEveryNum === 0 && levelNum < blinds.length;
                return (
                  <>
                    <tr key={i}>
                      <td className="px-2 py-[3px] text-[#444] text-[12px] text-center">{levelNum}</td>
                      <td className="px-2 py-[3px]">
                        <input
                          type="number" min="1" value={level.sb || ''}
                          onChange={e => updateBlind(i, 'sb', e.target.value)}
                          className={blindInputBase}
                        />
                      </td>
                      <td className="px-2 py-[3px]">
                        <input
                          type="number" min="1" value={level.bb || ''}
                          onChange={e => updateBlind(i, 'bb', e.target.value)}
                          className={blindInputBase}
                        />
                      </td>
                      <td className="px-2 py-[3px]">
                        <button onClick={() => removeBlind(i)} className="bg-none border-none text-[#444] cursor-pointer text-[16px] px-2 py-1 rounded hover:text-red-500 hover:bg-[#2a1a1a]">
                          ✕
                        </button>
                      </td>
                    </tr>
                    {showBreak && (
                      <tr key={`break-${i}`} className="border-y border-[#2a2a3a]">
                        <td colSpan={4} className="px-2 py-[6px] text-[#4a4a7a] text-[11px] tracking-[1px]">
                          ── ☕ Перерыв ──────────────────────
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
          {errors.blinds && <div className="text-red-500 text-[13px] mt-2">{errors.blinds}</div>}
          <button
            onClick={addBlind}
            className="bg-none border border-dashed border-[#2a2a2a] text-[#555] w-full py-2 rounded-[6px] mt-[6px] cursor-pointer text-[13px] hover:border-violet-700 hover:text-violet-500"
          >
            + добавить уровень
          </button>
        </div>

        {/* Display section */}
        <div>
          <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Отображение</div>
          <label className="flex items-center gap-3 cursor-pointer bg-[#242424] rounded-lg p-[12px_14px]">
            <input
              type="checkbox"
              checked={showCombos}
              onChange={e => setShowCombos(e.target.checked)}
              className="w-[18px] h-[18px] accent-violet-600 cursor-pointer"
            />
            <span className="text-[14px] text-[#ccc]">Показывать таблицу покерных комбинаций</span>
          </label>
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Шаг 2: Коммит**

```bash
git add components/SettingsScreen.tsx
git commit -m "feat: SettingsScreen component with validation"
```

---

## Task 13: PokerTimer — главный компонент

**Files:**
- Create: `components/PokerTimer.tsx`

- [ ] **Шаг 1: Создать `components/PokerTimer.tsx`**

```tsx
'use client';
import { useReducer, useEffect, useRef, useCallback } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { saveConfig } from '@/lib/storage';
import { getTimerChannel } from '@/supabase/client';
import { BlindInfo } from './BlindInfo';
import { TimerDisplay } from './TimerDisplay';
import { Controls } from './Controls';
import { CombosPanel } from './CombosPanel';
import { SettingsScreen } from './SettingsScreen';
import type { Config } from '@/types/timer';

export function PokerTimer() {
  const [state, dispatch] = useReducer(timerReducer, undefined, createInitialState);
  const suppressUntilRef = useRef<number>(0);
  const channelRef = useRef(getTimerChannel(process.env.NEXT_PUBLIC_SESSION_ID ?? 'main'));

  // Timer interval
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, []);

  // Clock display
  const [clock, setClock] = useClockState();

  // Audio side effects
  useEffect(() => {
    if (!state.pendingSound) return;
    const event = state.pendingSound;
    const now = Date.now();
    if (event === 'tick' && now < suppressUntilRef.current) {
      dispatch({ type: 'CLEAR_SOUND' });
      return;
    }
    if (event !== 'tick') {
      suppressUntilRef.current = now + 3500;
    }
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
      payload: {
        currentStage: state.currentStage,
        timeLeft: state.timeLeft,
        isPaused: state.isPaused,
      },
    });
  }, [state.currentStage, state.timeLeft, state.isPaused]);

  // Keyboard: Space → toggle pause
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleSaveSettings = useCallback((config: Config) => {
    dispatch({ type: 'SAVE_SETTINGS', config });
  }, []);

  const stage = state.stages[state.currentStage];
  const isWarning = state.timeLeft <= 60 && state.timeLeft >= 0 && stage.type !== 'break';

  if (state.screen === 'settings') {
    return (
      <SettingsScreen
        config={state.config}
        onSave={handleSaveSettings}
        onClose={() => dispatch({ type: 'CLOSE_SETTINGS' })}
      />
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden select-none transition-[background] duration-[1500ms] ${isWarning ? 'bg-[#3a1a0a]' : 'bg-[#1a1a1a]'}`}>
      {/* Top bar */}
      <div className="flex justify-between items-start px-7 pt-5">
        <BlindInfo
          stage={stage}
          stages={state.stages}
          currentStage={state.currentStage}
          breakDuration={state.config.breakDuration}
        />
        <div className="flex gap-1 items-center">
          <button
            className="bg-none border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
            onClick={toggleFullscreen}
            title="Fullscreen"
          >
            ⛶
          </button>
          <button
            className="bg-none border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
            onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Timer + progress */}
      {!state.isOver && (
        <TimerDisplay
          timeLeft={state.timeLeft}
          stage={stage}
          isPaused={state.isPaused}
        />
      )}

      {/* Tournament over screen */}
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
          onPrev={() => dispatch({ type: 'PREV_STAGE' })}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          onNext={() => dispatch({ type: 'NEXT_STAGE' })}
          onOpenSettings={() => dispatch({ type: 'OPEN_SETTINGS' })}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {/* Combos panel */}
      {!state.isOver && (
        <CombosPanel
          visible={state.config.showCombos !== false}
          onToggle={() => {
            const newConfig = { ...state.config, showCombos: !state.config.showCombos };
            saveConfig(newConfig);
            dispatch({ type: 'SAVE_SETTINGS', config: newConfig });
          }}
        />
      )}

      {/* Clock */}
      <div className="fixed bottom-[18px] right-7 text-[28px] font-bold text-[#444] tabular-nums tracking-[2px] pointer-events-none">
        {clock}
      </div>
    </div>
  );
}

function useClockState(): [string, React.Dispatch<React.SetStateAction<string>>] {
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
  return [clock, setClock];
}
```

> **Примечание:** `useState` и `React` нужно импортировать вверху файла. Добавь в начало:
> ```tsx
> import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
> import type React from 'react';
> ```
> (убери дублирующий импорт useReducer и т.д. из шага выше)

- [ ] **Шаг 2: Исправить импорты в `components/PokerTimer.tsx`**

Начало файла должно быть:

```tsx
'use client';
import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { saveConfig } from '@/lib/storage';
import { getTimerChannel } from '@/supabase/client';
import { BlindInfo } from './BlindInfo';
import { TimerDisplay } from './TimerDisplay';
import { Controls } from './Controls';
import { CombosPanel } from './CombosPanel';
import { SettingsScreen } from './SettingsScreen';
import type { Config } from '@/types/timer';
```

- [ ] **Шаг 3: Коммит**

```bash
git add components/PokerTimer.tsx
git commit -m "feat: PokerTimer main component with reducer, audio, Supabase"
```

---

## Task 14: app/layout.tsx + app/page.tsx

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Шаг 1: Обновить `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Poker Timer',
  description: 'Poker tournament blind timer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#1a1a1a] text-white overflow-hidden">{children}</body>
    </html>
  );
}
```

- [ ] **Шаг 2: Обновить `app/page.tsx`**

```tsx
import { PokerTimer } from '@/components/PokerTimer';

export default function Home() {
  return <PokerTimer />;
}
```

- [ ] **Шаг 3: Запустить dev-сервер и открыть приложение**

```bash
npm run dev
```

Открыть `http://localhost:3000`. Ожидаем: таймер отображается, Round 1 / 10/20, большая цифра 20:00 в центре.

- [ ] **Шаг 4: Коммит**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: app layout and root page wiring"
```

---

## Task 15: Версия + финальная проверка

**Files:**
- Modify: `components/SettingsScreen.tsx` (версия уже обновлена на 3.20)
- Modify: `CLAUDE.md`

- [ ] **Шаг 1: Прогнать все тесты**

```bash
npm test
```

Ожидаем: все тесты зелёные, `0 failed`.

- [ ] **Шаг 2: Запустить полный сценарий вручную**

| Сценарий | Ожидаемый результат |
|----------|---------------------|
| Открыть `localhost:3000` | Round 1, 10/20, 20:00, на паузе |
| Нажать ▶ | Таймер пошёл |
| Пробел | Пауза (PAUSE overlay) |
| Пробел снова | Старт |
| ⏩ → ⏩ | Перерыв: синий таймер, ☕ Break |
| ⏩ из перерыва | Round 3, тройной beep |
| ⚙ | Экран настроек открылся, таймер встал |
| Изменить длительность → Сохранить | Таймер сброшен с новыми значениями |
| Клик на комбо-панель | Панель скрылась / показалась |
| Открыть настройки → ← Назад | Вернулись без изменений |
| В DevTools: `timeLeft = 62; warnedOneMin = false` *(нет прямого доступа — проверить через ⏩ на следующий уровень и подождать 1 мин)* | Голосовая фраза за 1 мин до конца |
| Перейти на последний уровень, дождаться 0 | Overtime: красный таймер уходит в минус |

- [ ] **Шаг 3: Обновить версию в CLAUDE.md**

В `CLAUDE.md` заменить:
```
Текущая версия: **3.19**
```
на:
```
Текущая версия: **3.20**
```

И обновить строку с версией в коде:
```html
<div style="font-size:11px;color:#444;margin-top:2px;">v3.19</div>
```
→ уже обновлена в `SettingsScreen.tsx` как `v3.20`.

- [ ] **Шаг 4: Финальный коммит**

```bash
git add CLAUDE.md
git commit -m "feat: poker timer v3.20 — Next.js migration (issue #2)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Next.js App Router, TypeScript, Tailwind — Task 1
- ✅ Компонентная декомпозиция (вариант B) — Tasks 8–13
- ✅ useReducer с полным набором actions — Task 5
- ✅ lib/timer.ts, lib/audio.ts, lib/storage.ts — Tasks 3–6
- ✅ Supabase Realtime Broadcast (исходящий) — Task 7 + Task 13
- ✅ sessionId='main' из ENV — Task 7
- ✅ MP3 файлы в public/audio/ — Task 6
- ✅ localStorage ключ pokerTimerConfig сохранён — Task 4
- ✅ Overtime, warning, combos panel — Tasks 9–13
- ✅ Fullscreen, пробел, часы — Task 13
- ✅ Версия 3.20 — Task 15

**Placeholders:** отсутствуют.

**Type consistency:** `SoundEvent`, `Config`, `Stage`, `TimerState`, `Action` — определены в Task 2, используются консистентно во всех задачах.
