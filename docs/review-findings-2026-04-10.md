# Review findings — 2026-04-10

Проверка проекта `/Users/ekoshkin/poker`.

## Краткий итог

Проект выглядит как живой MVP с хорошей декомпозицией доменной логики: таймер, расчеты игры и reducer вынесены из UI и уже частично покрыты тестами. Основные риски сейчас не в структуре, а в красном quality gate и нескольких сценариях синхронизации/администрирования, которые могут проявиться в проде.

## Findings

### Finding 1: [P1] Fallback Supabase channel crashes without env

Файл: `/Users/ekoshkin/poker/supabase/client.ts:17`

Когда `NEXT_PUBLIC_SUPABASE_URL` или `NEXT_PUBLIC_SUPABASE_ANON_KEY` отсутствуют, `getTimerChannel()` возвращает fallback-объект с `subscribe`, `unsubscribe` и `send`, но `TimerProvider` сразу вызывает `channel.on(...)`. В локальной разработке, preview-окружении или misconfigured Vercel env приложение упадет при mount вместо graceful-disable realtime.

Рекомендация: добавить no-op `on()` в fallback channel или изменить `TimerProvider`, чтобы он не подписывался на realtime без Supabase client.

### Finding 2: [P1] Realtime misses remote session creation

Файл: `/Users/ekoshkin/poker/context/GameContext.tsx:136`

Realtime-подписка обрабатывает `session_players` `INSERT`/`UPDATE` через обновление уже существующих строк и слушает `sessions` только на `UPDATE`. Если новая сессия стартует на другом устройстве, текущий клиент не получит активную сессию и ее игроков до reload/refetch.

Рекомендация: слушать `sessions INSERT`, при `session_players INSERT` добавлять запись в state, а для важных событий делать `fetchActiveSession()` как источник истины.

### Finding 3: [P1] Mobile admin bypasses max rebuys

Файл: `/Users/ekoshkin/poker/components/MobileAdminPanel.tsx:40`

Desktop UI отключает кнопку ребая при достижении `maxRebuys`, но mobile admin plus-button всегда вызывает `doRebuy`. Админ с телефона может превысить лимит ребаев и исказить банк/количество фишек.

Рекомендация: применить ту же проверку `maxRebuys` в mobile UI и дополнительно защитить `doRebuy()` на уровне `GameContext`, чтобы ограничение не зависело от компонента.

### Finding 4: [P1] Timer reducer tests are stale

Файл: `/Users/ekoshkin/poker/__tests__/reducer/timerReducer.test.ts:10`

`makeState()` не задает обязательные `anchorTs` и `elapsedBeforePause`, а reducer теперь считает время от anchor timestamp. Jest получает `NaN` в `TICK`-тестах, поэтому самое важное поведение таймера сейчас не защищено passing test suite.

Рекомендация: обновить тестовые fixtures под anchor-based timer, мокать `Date.now()` и проверять wall-clock сценарии переходов, предупреждений и overtime.

### Finding 5: [P2] Jest scans nested worktree

Файл: `/Users/ekoshkin/poker/jest.config.ts:12`

Внутри репозитория есть `.worktrees/nextjs-migration`, и Jest индексирует тесты оттуда тоже. Это вызывает collision по `package.json` и дублирует падения тестов.

Рекомендация: добавить `.worktrees` в `testPathIgnorePatterns`/`modulePathIgnorePatterns` или держать git worktrees вне корня проекта.

## Проверки

- `npx tsc --noEmit --pretty false --incremental false` — падает: отсутствуют Jest globals/types (`describe`, `test`, `expect`) и есть несовместимость тестового `TimerState`.
- `npm test -- --runInBand --cacheDirectory /tmp/jest-cache-poker` — падает из-за `.worktrees`.
- `npx jest --runInBand --cacheDirectory /tmp/jest-cache-poker --testPathIgnorePatterns '/.worktrees/'` — падает: 5 failed, 40 passed; все падения в `__tests__/reducer/timerReducer.test.ts`.

## Приоритетный план

1. Починить quality gate: добавить `typecheck`, настроить Jest ignore для `.worktrees`, подключить `@types/jest` или отдельный test tsconfig.
2. Обновить reducer-тесты под anchor-based модель таймера.
3. Закрыть Supabase fallback crash.
4. Исправить realtime-синхронизацию создания сессий.
5. Перенести лимит `maxRebuys` из UI в `GameContext` как бизнес-правило.
6. После зеленого baseline запустить `next build` и добавить его в регулярную проверку.

