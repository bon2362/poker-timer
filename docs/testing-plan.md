# Poker Timer — План тестирования

> **Дата:** 2026-04-11  
> **Issue:** [#61](https://github.com/bon2362/poker-timer/issues/61)

---

## 1. Текущее состояние

### 1.1 Что покрыто

| Файл | Stmts | Branch | Funcs | Lines | Тестов |
|------|-------|--------|-------|-------|--------|
| `lib/timer.ts` | 97% | 83% | 100% | 97% | 18 |
| `lib/game.ts` | 100% | 75% | 100% | 100% | 7 |
| `lib/storage.ts` | 100% | 100% | 100% | 100% | 5 |
| `lib/supabase/timerState.ts` | 55% | 35% | 50% | 62% | ~5 |
| `reducer/timerReducer.ts` | 73% | 74% | 100% | 77% | 16 |
| **Итого** | **70%** | **60%** | **68%** | **74%** | **51** |

### 1.2 Что НЕ покрыто

| Слой | Файлов | Покрытие |
|------|--------|----------|
| Компоненты (`components/`) | 19 | 0% |
| Контексты (`context/`) | 3 | 0% |
| Supabase-интеграции (`lib/supabase/` кроме timerState) | 5 | 0% |
| `lib/audio.ts` | 1 | 0% |
| E2E-сценарии | — | нет |
| Визуальное тестирование | — | нет |

### 1.3 Общая оценка

**Сильные стороны:**
- Чистая бизнес-логика (timer, game, storage) покрыта отлично — это правильный фундамент
- Reducer покрыт на ~75%, что для state machine — хороший старт
- Тесты быстрые (0.6 сек), инфраструктура Jest уже настроена

**Проблемные зоны:**
- UI-слой полностью без тестов — нет защиты от визуальных регрессий
- Supabase Realtime-синхронизация не тестируется — это критический путь приложения
- Нет e2e-тестов — пользовательские сценарии проверяются только вручную
- Мобильная версия не тестируется отдельно, хотя имеет свою логику (MobileView, MobileAdminPanel)

---

## 2. План юнит-тестов

### 2.1 Приоритет 1 — Расширить покрытие существующих модулей

**`reducer/timerReducer.ts`** (сейчас 73% → цель 95%)

Непокрытые ветки:
- `RESTORE_STATE` — восстановление из Supabase (строки 209–244)
- `JUMP_TO_END` — переход к последнему уровню (строки 254–257)
- Edge cases: overtime-режим, переходы между стадиями при `isOver`
- Звуковые предупреждения: `warnBlinds`, `warnBreak`, `warnEndBreak`

**`lib/supabase/timerState.ts`** (сейчас 55% → цель 90%)

Непокрытые ветки:
- `restoreTimerState` — парсинг persisted stages
- `isTimerStateStale` — проверка актуальности состояния
- Обработка ошибок Supabase

### 2.2 Приоритет 2 — Новые юнит-тесты

**`lib/supabase/players.ts`** — CRUD-операции с игроками
- fetchPlayers, createPlayer, updatePlayer, deletePlayer
- Обработка ошибок Supabase (сетевые сбои, конфликты)

**`lib/supabase/sessions.ts`** — управление сессиями
- fetchActiveSession, createSession, finishSession
- updateSessionPlayers (rebuys, add-ons, elimination)

**`lib/audio.ts`** — воспроизведение звуков
- Корректный выбор аудиофайла по событию
- Graceful degradation при отсутствии Audio API

### 2.3 Приоритет 3 — Компонентные тесты (React Testing Library)

Ключевые компоненты для покрытия:

| Компонент | Что тестировать | Сложность |
|-----------|----------------|-----------|
| `TimerDisplay` | Отображение времени, цвета (overtime=red, warning=orange, break=blue), прогресс-бар | Низкая |
| `Controls` | Клик на play/pause/next/prev/reset, disabled-состояния | Низкая |
| `BlindInfo` | Отображение текущих и следующих блайндов | Низкая |
| `SettingsScreen` | Сохранение настроек, редактирование блайндов, валидация ввода | Высокая |
| `PlayerForm` | Создание/редактирование игрока, валидация формы | Средняя |
| `SessionSetup` | Конфигурация buy-in, rebuys, призовых мест | Средняя |
| `GamePanel` | Таблица игроков, сортировка, действия (eliminate, rebuy) | Средняя |
| `PrizeSummary` | Расчёт призового фонда, корректные проценты | Низкая |
| `MobileAdminPanel` | Мобильные контролы, управление игроками | Средняя |
| `WinnerScreen` | Отображение победителя, анимации | Низкая |

**Подход к моканью:**
- Supabase-клиент — мокать через `jest.mock('@/supabase/client')`
- Контексты — оборачивать в `<TimerProvider>` / `<GameProvider>` с controlled state
- Audio API — мокать `HTMLAudioElement`

### 2.4 Приоритет 4 — Тесты контекстов

| Контекст | Что тестировать |
|----------|----------------|
| `TimerContext` | Инициализация reducer, dispatch TICK, подписка на Realtime, echo suppression |
| `GameContext` | Загрузка сессии/игроков, CRUD-операции, Realtime-подписка |
| `MinuteTimerContext` | Запуск/остановка обратного отсчёта |

---

## 3. План E2E-тестов

### 3.1 Инструмент: Playwright

**Почему Playwright:**
- Поддержка Chromium, Firefox, WebKit (Safari) из коробки
- Встроенная эмуляция мобильных устройств
- Поддержка нескольких вкладок/контекстов (критично для тестирования Realtime-синхронизации)
- Визуальное сравнение скриншотов
- Playwright уже доступен в проекте через MCP

### 3.2 Сценарии — Desktop (≥768px)

**Критический путь: Таймер**

| # | Сценарий | Шаги |
|---|----------|------|
| E1 | Запуск и пауза таймера | Открыть → нажать Play → проверить отсчёт → нажать Pause → время остановилось |
| E2 | Переход между уровнями | Запустить → Next Stage → проверить блайнды изменились → Prev Stage → вернулись |
| E3 | Автопереход уровня | Дождаться конца уровня → проверить автопереход → новые блайнды |
| E4 | Overtime-режим | Дойти до последнего уровня → время уходит в минус → красный таймер |
| E5 | Звуковое предупреждение | За 1 мин до конца уровня → проверить overlay MinuteTimer |
| E6 | Keyboard shortcuts | Пробел = pause/resume, проверить работу |

**Критический путь: Управление игрой**

| # | Сценарий | Шаги |
|---|----------|------|
| E7 | Создание сессии | SessionSetup → заполнить buy-in, стэк → Start → сессия активна |
| E8 | Добавление игроков | Открыть PlayerManager → добавить 3 игроков → проверить в GamePanel |
| E9 | Элиминация и ребай | Eliminate игрока → статус changed → Rebuy → вернулся в игру |
| E10 | Определение победителя | Eliminate всех кроме одного → WinnerScreen отображается |
| E11 | Призовой фонд | Настроить 3 призовых места → проверить корректные суммы в PrizeSummary |

**Настройки**

| # | Сценарий | Шаги |
|---|----------|------|
| E12 | Изменение блайндов | Settings → изменить блайнды → Save → перезапустить таймер → новые блайнды |
| E13 | Изменение длительности уровней | Settings → изменить duration → Save → таймер показывает новое время |
| E14 | Persistence | Settings → Save → reload страницы → настройки сохранены |

**Realtime-синхронизация (multi-tab)**

| # | Сценарий | Шаги |
|---|----------|------|
| E15 | Синхронизация таймера | Tab1: Play → Tab2: проверить таймер тикает → Tab1: Pause → Tab2: пауза |
| E16 | Синхронизация игроков | Tab1: eliminate player → Tab2: статус обновился |

### 3.3 Сценарии — Mobile (<768px)

| # | Сценарий | Шаги | Viewport |
|---|----------|------|----------|
| M1 | Мобильный layout | Открыть на 375×812 → MobileView рендерится, не PokerTimer | iPhone 14 |
| M2 | Мобильная admin-панель | Открыть MobileAdminPanel → управление игроками работает | iPhone 14 |
| M3 | Таймер на мобильном | Play/Pause через мобильный интерфейс → таймер работает | iPhone 14 |
| M4 | Элиминация с мобильного | Eliminate игрока через мобильный интерфейс → обновление | iPhone 14 |
| M5 | Landscape-режим | Повернуть в 812×375 → layout адаптируется | iPhone 14 landscape |
| M6 | Планшет | Открыть на 1024×768 → desktop-layout | iPad |

### 3.4 Структура файлов Playwright

```
e2e/
├── playwright.config.ts
├── fixtures/
│   └── test-config.ts          # Общие настройки, моки Supabase
├── desktop/
│   ├── timer.spec.ts           # E1–E6
│   ├── game-management.spec.ts # E7–E11
│   ├── settings.spec.ts        # E12–E14
│   └── realtime-sync.spec.ts   # E15–E16
├── mobile/
│   ├── layout.spec.ts          # M1, M5, M6
│   ├── admin-panel.spec.ts     # M2, M4
│   └── timer.spec.ts           # M3
└── visual/
    ├── desktop-screenshots.spec.ts
    └── mobile-screenshots.spec.ts
```

---

## 4. Визуальное тестирование

### 4.1 Подход: Playwright screenshot comparison

Playwright имеет встроенный `toHaveScreenshot()` — этого достаточно для старта.

**Ключевые экраны для визуальных тестов:**

| Экран | Desktop | Mobile |
|-------|---------|--------|
| Таймер (idle) | ✓ | ✓ |
| Таймер (playing) | ✓ | ✓ |
| Таймер (overtime, красный) | ✓ | ✓ |
| Таймер (break, синий) | ✓ | ✓ |
| Settings | ✓ | — |
| GamePanel | ✓ | ✓ |
| WinnerScreen | ✓ | ✓ |
| MinuteTimerOverlay | ✓ | ✓ |
| CombosPanel | ✓ | — |

### 4.2 Когда прогонять

- Визуальные тесты — только в CI (не в локальной разработке)
- Обновление базовых скриншотов — через `npx playwright test --update-snapshots`
- Дельта допуска: `maxDiffPixelRatio: 0.01` (1%)

---

## 5. Метрики качества

### 5.1 Основные метрики

| Метрика | Текущее значение | Цель (3 мес.) | Цель (6 мес.) |
|---------|-----------------|---------------|---------------|
| Unit test coverage (lines) | 74% (только lib/reducer) | 80% (включая компоненты) | 90% |
| Unit test coverage (branches) | 60% | 75% | 85% |
| Кол-во юнит-тестов | 51 | 120+ | 200+ |
| E2E-сценариев (desktop) | 0 | 10+ | 16 |
| E2E-сценариев (mobile) | 0 | 4+ | 6 |
| Визуальных тестов | 0 | 8+ | 18 |
| Время прогона юнит-тестов | 0.6 сек | <3 сек | <5 сек |
| Время прогона e2e-тестов | — | <2 мин | <3 мин |

### 5.2 Дополнительные метрики

- **Flaky test rate** — % тестов, которые нестабильно проходят. Цель: <2%
- **Mean time to detect regression** — как быстро CI ловит баг после push. Цель: <5 мин
- **Test-to-code ratio** — соотношение строк тестов к строкам кода. Ориентир: 1:1–1.5:1

---

## 6. Инструменты для отслеживания качества

### 6.1 Покрытие юнит-тестами

| Инструмент | Назначение | Стоимость |
|------------|-----------|-----------|
| **[Codecov](https://codecov.io)** | Отслеживание покрытия юнит-тестов, PR-комментарии с дельтой, графики трендов | Бесплатно для open-source |
| **Jest `--coverage`** (уже есть) | Локальный отчёт покрытия | Бесплатно |

**Настройка Codecov:**
1. Добавить `CODECOV_TOKEN` в GitHub Secrets
2. В CI: `npx jest --coverage --coverageReporters=lcov`
3. Upload через `codecov/codecov-action@v4`

### 6.2 Покрытие E2E-тестами

| Инструмент | Назначение | Стоимость |
|------------|-----------|-----------|
| **Playwright `--coverage`** + [istanbul](https://istanbul.js.org/) | Собирает code coverage из e2e-прогонов через V8 coverage API | Бесплатно |
| **[Currents.dev](https://currents.dev)** | Дашборд для Playwright: история прогонов, flaky tests, параллелизация, тренды покрытия | Бесплатно до 5k тестов/мес |
| **[Codecov](https://codecov.io)** (тот же) | Может объединять coverage из юнит-тестов и e2e в один отчёт через `flag` | Бесплатно |

**Как собрать e2e coverage:**
1. Инструментировать код через `istanbul` (babel-plugin или V8 coverage)
2. После каждого e2e-теста собрать `window.__coverage__`
3. Объединить через `nyc merge`
4. Загрузить в Codecov с флагом `--flag e2e`

### 6.3 Визуальные регрессии

| Инструмент | Назначение | Стоимость |
|------------|-----------|-----------|
| **Playwright `toHaveScreenshot()`** (рекомендую на старте) | Встроенное попиксельное сравнение, baseline хранится в репо | Бесплатно |
| **[Chromatic](https://www.chromatic.com/)** (опционально, в будущем) | Облачный визуальный ревью для Storybook, удобен для дизайн-ревью | Бесплатно до 5k снапшотов/мес |
| **[Percy (BrowserStack)](https://percy.io/)** | Облачный визуальный тестинг, кросс-браузерные скриншоты | Бесплатно до 5k снапшотов/мес |

**Рекомендация:** начать с Playwright `toHaveScreenshot()` — бесплатно, не требует внешних сервисов, baseline в git.

### 6.4 Общий мониторинг качества

| Инструмент | Назначение | Стоимость |
|------------|-----------|-----------|
| **[SonarCloud](https://sonarcloud.io/)** | Статический анализ: баги, code smells, дублирование, security hotspots, покрытие | Бесплатно для open-source |
| **[GitHub Actions](https://github.com/features/actions)** | CI-пайплайн для запуска тестов на каждый PR | Бесплатно для open-source |

---

## 7. CI-пайплайн

### 7.1 Рекомендуемый GitHub Actions workflow

```yaml
# .github/workflows/test.yml
name: Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx jest --coverage --coverageReporters=lcov
      - uses: codecov/codecov-action@v4
        with:
          flags: unit
          token: ${{ secrets.CODECOV_TOKEN }}

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### 7.2 PR Checks

Каждый PR должен проходить:
1. ✅ Юнит-тесты — все зелёные
2. ✅ Покрытие не упало (Codecov PR comment)
3. ✅ E2E-тесты — ключевые сценарии
4. ✅ Визуальные тесты — нет неожиданных изменений (если настроены)
5. ✅ TypeScript — `tsc --noEmit` без ошибок
6. ✅ Lint — `eslint` без ошибок (если настроен)

---

## 8. Roadmap внедрения

### Фаза 1 — Фундамент (1–2 недели)

- [ ] Настроить GitHub Actions CI с юнит-тестами
- [ ] Подключить Codecov для отслеживания покрытия
- [ ] Дописать юнит-тесты reducer до 95% (приоритет 1)
- [ ] Дописать тесты `lib/supabase/timerState.ts` до 90%

### Фаза 2 — Компоненты (2–3 недели)

- [ ] Написать тесты для «простых» компонентов: TimerDisplay, Controls, BlindInfo, PrizeSummary
- [ ] Написать тесты для форм: PlayerForm, SessionSetup, PrizeConfig
- [ ] Написать тесты для SettingsScreen (самый большой компонент)
- [ ] Написать тесты для контекстов (TimerContext, GameContext)

### Фаза 3 — E2E (2–3 недели)

- [ ] Установить и настроить Playwright
- [ ] Написать e2e-тесты критического пути таймера (E1–E6)
- [ ] Написать e2e-тесты управления игрой (E7–E11)
- [ ] Написать мобильные e2e-тесты (M1–M4)
- [ ] Добавить e2e в CI

### Фаза 4 — Визуальные тесты и polish (1–2 недели)

- [ ] Настроить Playwright screenshot comparison
- [ ] Создать baseline-скриншоты для desktop и mobile
- [ ] Добавить тесты Realtime-синхронизации (E15–E16)
- [ ] Подключить Currents.dev или SonarCloud (опционально)

---

## 9. Резюме рекомендаций

| Что | Инструмент | Зачем |
|-----|-----------|-------|
| Юнит-тесты | **Jest + React Testing Library** (уже есть) | Быстрые, покрывают логику и компоненты |
| E2E-тесты | **Playwright** | Кросс-браузерный, мобильная эмуляция, multi-tab |
| Визуальные тесты | **Playwright `toHaveScreenshot()`** | Бесплатно, baseline в git |
| Покрытие (unit) | **Codecov** | Тренды, PR-комментарии, бесплатно для OSS |
| Покрытие (e2e) | **Codecov** с флагом `e2e` | Единый дашборд с юнит-покрытием |
| CI | **GitHub Actions** | Бесплатно, интеграция с Codecov и Playwright |
| Flaky tests | **Currents.dev** | Дашборд, параллелизация, история |
| Статический анализ | **SonarCloud** | Code smells, дублирование, security |
