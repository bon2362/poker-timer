# История игр: план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Публичные страницы завершённых игр и каталог с общей таблицей, единая база фото для страниц и карусели, постоянная запись итогов игры, вход в админку по одному паролю.

**Architecture:** Новые поля и таблицы добавляются в существующую базу Supabase. Публичные страницы — серверные страницы Next.js, читающие базу публичным ключом. Все защищённые записи идут через маршруты `/api/admin/*`, которые проверяют подписанный cookie и работают служебным ключом. Действия во время игры (ребаи, вылеты, таймер) продолжают писать в базу из браузера.

**Tech Stack:** Next.js 16.4 App Router, React 19.2, TypeScript, Tailwind CSS, Supabase (Postgres, Storage, Realtime), Jest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-01-game-history-design.md`. Дизайн: `/Users/ekoshkin/Downloads/design_handoff_games_admin/` (`README.md`, прототипы в `design/`). Расхождения README с проектом решены в разделе «Дизайн» описания: README не менять, следовать таблице оттуда.

## Global Constraints

- Не коммитить и не пушить без явной просьбы пользователя. Пуш в `main` сразу выкладывает код, поэтому работа ведётся в отдельной ветке.
- SQL выполняет владелец проекта в SQL Editor на сайте Supabase. Каждый SQL-файл начинается с инструкции на русском простым языком и заканчивается проверочными `SELECT` с ожидаемым результатом.
- Порядок выкладки: сначала SQL, потом зависящий от него код. Не выкладывать в день игры.
- Секреты не вписывать в команды и файлы: только `.env.local` и переменные Vercel (`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`). Служебный ключ никогда не получает префикс `NEXT_PUBLIC_`.
- Новые экраны: только классы Tailwind, тема через `dark:`, без inline-стилей.
- Маршруты и страницы с данными из базы: `export const dynamic = 'force-dynamic'`.
- Новые зависимости не добавлять. В Next.js 16 не использовать `middleware`/`proxy`: проверка входа выполняется в маршрутах и серверных страницах.
- Каждая выкладка поднимает минорную версию (первая — 6.1), добавляет запись в `CHANGELOG` в `components/SettingsScreen.tsx` и обновляет строку версии в `CLAUDE.md` (сейчас там ошибочно 5.2).
- Часовой пояс дат игр: `Europe/Belgrade`. Суммы в RSD.
- Запрещено запускать `npm run test:e2e` и `npx playwright test` без параметров: по умолчанию они идут на рабочий сайт. Запрещено запускать e2e с `CI=1` без отключения базы: `e2e/desktop/two-tables.spec.ts` сам читает `.env.local`, завершает активные игры и пишет в рабочую базу. Единственная разрешённая команда e2e (далее «безопасный e2e»): `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= CI=1 npx playwright test --project=desktop --project=mobile --grep-invert "Two-table"`.

## Review Focus

- Истёк или отсутствует вход на устройстве в момент отметки победителя: игра не теряет данные, человек видит понятную ошибку и может повторить. Тест в задаче 5.
- Две игры завершаются в один день, в том числе почти одновременно: вторая получает адрес с `-2`, а не ошибку. Тест в задаче 3 и задаче 5.
- Часть файлов из пакета фото не загрузилась: для них нет записей в базе, остальные сохранены, и показан список неудачных. Тест в задаче 10.
- Некорректная правка результатов (два первых места, пропущенное место): отказ без частичной записи. Тест в задаче 10.
- Удаление игры с фото: фото остаются в карусели и переходят в «Без игры». Тест в задаче 10.

---

# Часть 1. База, вход и перенос данных

Не зависит от дизайна. Выкладывается целиком (задачи 5, 6 и 8 — одной выкладкой).

### Task 1: Новая схема базы и типы

**Files:**
- Create: `supabase/game_history_migration.sql`
- Modify: `types/game.ts`, `lib/supabase/sessions.ts`, `context/GameContext.tsx` (`rowToSessionPlayer`)
- Test: `__tests__/lib/sessionsMapping.test.ts`

**Interfaces:**
- Produces, таблицы и поля:
  - `sessions`: `slug text unique null`, `finished_at timestamptz null`, `finished_at_approximate boolean not null default false`, `blind_structure jsonb null`.
  - `session_players`: `payout integer null`, `loser_image_id uuid null references player_images`, `winner_image_id uuid null references player_images`.
  - `players`: `archived_at timestamptz null`.
  - `player_images`: `id`, `player_id` (references players), `kind` (`loser|winner`), `path`, `thumb_path`, `is_current boolean`, `created_at`. Уникальный индекс `(player_id, kind) where is_current`.
  - `game_photos`: `id`, `session_id uuid null references sessions on delete set null`, `path text unique`, `thumb_path text null`, `taken_at timestamptz null`, `width integer null`, `height integer null`, `created_at`.
- Produces, типы: `Session.slug/finishedAt/finishedAtApproximate/blindStructure`, `SessionPlayer.payout/loserImageId/winnerImageId`, `BlindStructure = Pick<Config, 'levelDuration' | 'breakDuration' | 'breakEvery' | 'blindLevels'>`.

- [ ] **Step 1: Написать падающий тест `toSession`/`toSessionPlayer`.** Экспортировать обе функции; тест подаёт строку с новыми полями и без них (старая запись) и проверяет `slug: null`, `payout: null`, `blindStructure: null`, а также заполненные значения.
- [ ] **Step 2:** `npx jest __tests__/lib/sessionsMapping.test.ts`. Ожидается FAIL.
- [ ] **Step 3: Обновить типы и обе функции преобразования.** `rowToSessionPlayer` из `GameContext` заменить импортом `toSessionPlayer`, чтобы не держать две копии.
- [ ] **Step 4:** `npx jest`. Ожидается PASS. В `NewSessionData` новые поля, кроме `blindStructure`, исключить из `Omit`.
- [ ] **Step 5: Написать SQL.** Только добавление, существующие данные не меняются. Для новых таблиц включить RLS и разрешить `anon` только `SELECT`. `player_images`: `anon` также нужен `SELECT` для снимка картинки в браузере. Добавить `game_photos` и `player_images` в чтение, Realtime не нужен. В проверочном `SELECT` показать новые столбцы из `information_schema.columns`.

### Task 2: Очистка и перенос данных

**Files:**
- Create: `supabase/game_history_data_migration.sql`

Весь файл — одна транзакция. Повторный запуск безопасен.

- [ ] **Step 1: Резервная копия.** `create table if not exists backup_20261101_sessions as select * from sessions`, то же для `session_players`. Включить на копиях RLS без политик: иначе они будут открыты через публичный ключ.
- [ ] **Step 2: Защита удаления.** Настоящие игры определяются по составу, а не только по дате:

```sql
-- keep: дата по Europe/Belgrade, участников, ребаев, аддонов
-- ('2026-05-10', 10, 3, 10) и ('2026-10-31', 8, 4, 7)
-- Если найдено не ровно 2 игры: RAISE EXCEPTION, транзакция откатывается.
```

При повторном запуске, когда лишних игр уже нет, блок завершается без ошибки. Сначала удаляются `session_players` чужих игр, затем `sessions`.
- [ ] **Step 3: Итоги двух игр.** Заполнить `payout` по формуле `calcGameStats`: на каждое призовое место, кроме последнего, `floor(bank × pct / 100)`, остаток — последнему призовому, остальным 0. `finished_at` = последний `eliminated_at`, `finished_at_approximate = true`. `slug`: `2026-may-10` и `2026-october-31`.
- [ ] **Step 4: Записи фото.** `insert into game_photos ... select from storage.objects where bucket_id = 'slideshow'` только для имён изображений; `taken_at` из имени вида `photo_87@06-02-2023_01-22-09.jpg` как время `Europe/Belgrade`; `on conflict (path) do nothing`. Фото с датой `2026-05-10` получают `session_id` майской игры. `width` и `height` у старых фото остаются пустыми.
- [ ] **Step 5: Записи текущих картинок.** Из `storage.objects` бакета `avatars` по шаблону `^(winner|loser)-<uuid>\.jpg$` создать строки `player_images` с `is_current = true`; `thumb_path` — если есть файл `-thumb.jpg`. Сами файлы не трогать.
- [ ] **Step 6: Проверочные запросы с ожидаемым результатом:** игр 2; участников 18; сумма `payout` майской игры 23 000, октябрьской 19 000; `game_photos` 412, из них с игрой 43. Файл прогоняется владельцем: сначала `begin; ... rollback;` (посмотреть проверки), затем на подтверждённый результат — с `commit`.

### Task 3: Чистые функции: адрес и расчёты

**Files:**
- Create: `lib/games/slug.ts`, `lib/games/results.ts`
- Test: `__tests__/lib/games/slug.test.ts`, `__tests__/lib/games/results.test.ts`

**Interfaces:**
- Produces:
  - `gameDateInBelgrade(iso: string): { year: number; month: number; day: number }`
  - `buildGameSlug(startedAtIso: string, takenSlugs: string[]): string`
  - `assignPayouts(session: Session, players: SessionPlayer[]): { id: string; payout: number }[]`
  - `calcPlayerCost(session: Session, player: SessionPlayer): number`
  - `validateResultPositions(positions: number[]): boolean`
  - `buildLeaderboard(games: { session: Session; players: SessionPlayer[] }[]): LeaderboardRow[]`, где `LeaderboardRow = { playerId: string; games: number; wins: number; prizes: number; totalWon: number; net: number }`

- [ ] **Step 1: Написать падающие тесты.**

```ts
expect(buildGameSlug('2026-11-01T19:00:00Z', [])).toBe('2026-november-01');
expect(buildGameSlug('2026-11-01T19:00:00Z', ['2026-november-01'])).toBe('2026-november-01-2');
expect(buildGameSlug('2026-11-01T19:00:00Z', ['2026-november-01', '2026-november-01-2'])).toBe('2026-november-01-3');
// 23:30 UTC 31 октября — уже 1 ноября в Белграде
expect(buildGameSlug('2026-10-31T23:30:00Z', [])).toBe('2026-november-01');

// assignPayouts: банк 19 000, проценты [50, 30, 20]
// места 1, 2, 3 → 9500, 5700, 3800; места 4–8 → 0; сумма = банк
// округление: банк 10 000, проценты [33, 33, 34] → 3300, 3300, 3400
// calcPlayerCost: бай-ин 1000, 2 ребая по 1000, аддон 1000 → 4000
// validateResultPositions: [1,2,3] true; [1,1,3] false; [1,3] false; [] false
// buildLeaderboard: net = totalWon − сумма calcPlayerCost; отрицательный net сохраняется;
// игрок учитывается как wins при finishPosition 1 и как prizes при payout > 0
```

- [ ] **Step 2:** `npx jest __tests__/lib/games`. Ожидается FAIL.
- [ ] **Step 3: Реализовать.** Названия месяцев — английские строчными, день двумя цифрами. Даты через `Intl.DateTimeFormat` с `timeZone: 'Europe/Belgrade'`. `assignPayouts` использует `calcGameStats(session, players).payouts`, без своей копии формулы.
- [ ] **Step 4:** `npx jest __tests__/lib/games`. Ожидается PASS.

### Task 4: Вход на сервере

**Files:**
- Create: `lib/admin/cookie.ts`, `lib/admin/requireAdmin.ts`, `lib/supabase/service.ts`, `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts`, `app/api/admin/session/route.ts`
- Test: `__tests__/lib/admin/cookie.test.ts`, `__tests__/app/api/adminLogin.test.ts` (оба `@jest-environment node`)

**Interfaces:**
- Produces:
  - `ADMIN_COOKIE = 'bsp_admin'`, срок `ADMIN_COOKIE_MAX_AGE = 365 * 24 * 60 * 60`
  - `signAdminCookie(secret: string, nowMs: number): string`
  - `verifyAdminCookie(value: string | undefined, secret: string, nowMs: number): boolean`
  - `isAdminRequest(): Promise<boolean>` (читает `cookies()` из `next/headers`)
  - `requireAdmin(): Promise<NextResponse | null>` — возвращает ответ 401 или `null`
  - `getServiceClient(): SupabaseClient`
  - `POST /api/admin/login { password } → 200 | 401`, `POST /api/admin/logout → 200` (удаляет cookie), `GET /api/admin/session → { authenticated: boolean }`

- [ ] **Step 1: Написать падающие тесты.** Верная подпись проходит; изменённая строка, чужой секрет, `undefined` и срок больше года — нет. Логин: верный пароль ставит cookie с `httpOnly`, `secure`, `sameSite=lax`, `maxAge`; неверный — 401 без cookie; незаданный `ADMIN_PASSWORD` — всегда 401.
- [ ] **Step 2:** `npx jest __tests__/lib/admin __tests__/app/api/adminLogin.test.ts`. Ожидается FAIL.
- [ ] **Step 3: Реализовать.** HMAC-SHA256 и `timingSafeEqual` из `node:crypto`. При неверном пароле ответ задерживается на 500 мс.
- [ ] **Step 4:** тот же запуск. Ожидается PASS.
- [ ] **Step 5:** Добавить названия переменных в `.env.local` с пустыми значениями и сообщить владельцу, что заполнить локально и на Vercel, не показывая значения в чате.

### Task 5: Запись итогов игры

**Files:**
- Create: `app/api/admin/games/[id]/declare-winner/route.ts`, `app/api/admin/games/[id]/finish/route.ts`
- Modify: `lib/supabase/sessions.ts`, `lib/supabase/players.ts`, `context/GameContext.tsx`, `components/SessionSetup/SessionSetup.tsx`, `components/WinnerScreen/WinnerScreen.tsx`, `components/PokerTimer.tsx:200`, `components/GamePanel/PlayerRow.tsx`, `components/MobileAdminPanel.tsx`
- Test: `__tests__/app/api/gameLifecycle.test.ts`, `__tests__/context/GameContext.test.tsx`, `__tests__/components/SessionSetup.test.tsx`

**Interfaces:**
- Consumes: `assignPayouts`, `buildGameSlug`, `requireAdmin`, `getServiceClient`, `getCurrentPlayerImage` (задача 6).
- Produces:
  - `POST /api/admin/games/[id]/declare-winner { sessionPlayerId } → { sessionPlayers: Row[] }`: победитель `status='winner'`, `finish_position=1`, `winner_image_id` = текущая картинка, `payout` всем участникам, `sessions.finished_at = now()`.
  - `POST /api/admin/games/[id]/finish → { slug }`: `status='finished'`, `slug`.
  - `GameContext.declareWinner` и `finishGame` возвращают `Promise<{ ok: boolean; error?: string }>`.

- [ ] **Step 1: Написать падающие тесты маршрутов.** Без cookie 401 и ни одной записи в базу. `declare-winner` записывает суммы, время и картинку. `finish` для игры без победителя возвращает 409. При ошибке уникальности `slug` выполняется повторная попытка со следующим номером.
- [ ] **Step 2: Написать падающие тесты контекста.** `startSession` передаёт `blindStructure` из настроек. `eliminatePlayer` записывает `loserImageId` текущей картинки, а `undoEliminate` ставит `null`. `removePlayer` записывает `archived_at`, не удаляя строку. Если `fetch` вернул 401 или сеть недоступна, `declareWinner` возвращает `{ ok: false }`, и состояние игры не меняется.
- [ ] **Step 3:** `npx jest __tests__/app/api/gameLifecycle.test.ts __tests__/context/GameContext.test.tsx`. Ожидается FAIL.
- [ ] **Step 4: Реализовать маршруты и контекст.** `SessionSetup` берёт конфигурацию из `useTimer().state.config`. `fetchPlayers` отбрасывает строки с `archived_at`, а `deletePlayer` становится архивированием. Ошибки `declareWinner` и `finishGame` показываются там, где вызваны кнопки: `PlayerRow`, `MobileAdminPanel`, `WinnerScreen`, `PokerTimer`.
- [ ] **Step 5:** `npx jest`. Ожидается PASS.

### Task 6: Версии картинок игроков

**Files:**
- Create: `lib/imageResize.ts`, `lib/supabase/signedUpload.ts`, `app/api/admin/uploads/sign/route.ts`, `app/api/admin/player-images/route.ts`
- Modify: `lib/supabase/imageVariants.ts`, `lib/supabase/storage.ts`, `components/PlayerManager/PlayerForm.tsx`
- Test: `__tests__/lib/imageVariants.test.ts`, `__tests__/app/api/playerImages.test.ts`

**Interfaces:**
- Produces:
  - `resizeContain`, `resizeCover`, вынесенные из `imageVariants.ts` в `lib/imageResize.ts`.
  - `POST /api/admin/uploads/sign { bucket: 'avatars' | 'slideshow'; files: { name: string }[] } → { uploads: { path: string; token: string }[] }`. Сервер сам задаёт случайный путь и не принимает его от клиента.
  - `uploadToSignedPath(bucket, path, token, blob, onProgress?: (percent: number) => void): Promise<boolean>` в `lib/supabase/signedUpload.ts`. Для процента загрузки использовать `XMLHttpRequest`, потому что клиент Supabase его не сообщает.
  - `POST /api/admin/player-images { playerId, kind, path, thumbPath }` переключает `is_current`. `DELETE /api/admin/player-images { playerId, kind }` снимает `is_current` и удаляет файл, только если на него нет ссылок в `session_players`.
  - `getCurrentPlayerImage(playerId, kind): Promise<{ id: string; url: string; thumbUrl: string } | null>`
  - Экспорты `getSpecialImageUrl`, `getSpecialThumbUrl`, `uploadSpecialImage`, `deleteSpecialImage` сохраняют сигнатуры.

- [ ] **Step 1: Написать падающие тесты.** Новая загрузка создаёт файл с новым путём и не перезаписывает старый. После загрузки `getSpecialImageUrl` отдаёт новую картинку, а строка, на которую ссылается `session_players`, по-прежнему указывает на старую. `DELETE` при наличии ссылки файл не удаляет. Без cookie — 401.
- [ ] **Step 2:** `npx jest __tests__/lib/imageVariants.test.ts __tests__/app/api/playerImages.test.ts`. Ожидается FAIL.
- [ ] **Step 3: Реализовать.** Удалить `ensureVariants` и `backfillVariants`: миниатюры уже созданы, а запись из браузера скоро закроется. `uploadAvatar` загружает по подписанной ссылке. Новый путь: `special/<kind>/<playerId>/<uuid>.jpg`.
- [ ] **Step 4:** `npx jest`. Ожидается PASS.

### Task 7: Карусель читает записи фото

**Files:**
- Modify: `lib/supabase/slideshow.ts`, `components/PokerTimer.tsx`, `components/SlideshowOverlay.tsx`
- Test: `__tests__/lib/slideshow.test.ts`, новые проверки в существующих тестах оверлея

**Interfaces:**
- Produces: `listSlideshowItems(): Promise<{ url: string; date: string | null }[]>`. `date` в формате `ДД.ММ.ГГГГ`, как сейчас выводит оверлей; источник — дата игры по `Europe/Belgrade`, иначе `taken_at`. `SlideshowOverlay` получает проп `date` вместо разбора имени файла. Настройки и финальное слайд-шоу продолжают получать список адресов из этой же функции.

- [ ] **Step 1: Написать падающие тесты.** Больше 1000 записей читаются все (постранично). Фото с игрой получает дату игры, фото без игры — дату из `taken_at`, без обеих — `null`.
- [ ] **Step 2:** `npx jest __tests__/lib/slideshow.test.ts`. Ожидается FAIL.
- [ ] **Step 3: Реализовать.** Формат вывода сверить с `parseDateFromUrl` (`components/SlideshowOverlay.tsx:14`) и затем удалить эту функцию.
- [ ] **Step 4:** `npx jest`. Ожидается PASS.

### Task 8: Закрыть управление паролем

**Files:**
- Create: `context/AdminAuthContext.tsx`, `components/admin/AdminLoginForm.tsx`, `app/admin/login/page.tsx`
- Modify: `app/page.tsx`, `components/PokerTimer.tsx`, `components/MobileView.tsx`, `components/WinnerScreen/WinnerScreen.tsx`, e2e-настройка в `playwright.config.ts`
- Test: `__tests__/context/AdminAuthContext.test.tsx`, `__tests__/components/AdminLoginForm.test.tsx`, новые проверки в `e2e/desktop/timer.spec.ts`, `e2e/mobile/admin-panel.spec.ts`

**Interfaces:**
- Produces: `useAdminAuth(): { isAdmin: boolean; checking: boolean; login(password: string): Promise<boolean> }`. Статус берётся из `GET /api/admin/session`.

- [ ] **Step 1: Написать падающие тесты.** Неверный пароль показывает ошибку. После успешного входа статус становится `isAdmin = true`. Без входа на компьютере нет кнопок управления и настроек, а клавиатурные команды не работают; таймер виден и идёт. На телефоне двойное касание открывает форму пароля, а не панель.
- [ ] **Step 2:** `npx jest __tests__/context/AdminAuthContext.test.tsx __tests__/components/AdminLoginForm.test.tsx`. Ожидается FAIL.
- [ ] **Step 3: Реализовать.** Форма по экрану 4 README; она показывается и на `/admin/login`, и поверх таймера при попытке войти в управление. Существующие e2e получают cookie через вспомогательную функцию входа. Тестовые `ADMIN_PASSWORD` и `ADMIN_SESSION_SECRET` задать в блоке `webServer.env` файла `playwright.config.ts`, чтобы тесты работали и в GitHub Actions, где секретов и базы нет. В двух шагах e2e, зависящих от входа и базы, использовать те же условия пропуска, что сейчас.
- [ ] **Step 4:** `npx jest`, затем безопасный e2e. Ожидается PASS.
- [ ] **Step 5: Выкладка части 1.** Порядок: владелец заполняет переменные на Vercel, выполняет `game_history_migration.sql`, затем `game_history_data_migration.sql`, затем выкладывается код. Проверить на рабочем сайте на обеих устройствах: вход, тестовая игра от старта до завершения, карусель на перерыве. Созданную проверочную игру удалить SQL-запросом владельца, пока нет кнопки.

---

# Часть 2. Экраны

Оформление, компоненты и тексты берутся из `README.md` и прототипов: inline-стили прототипов переводятся в классы Tailwind, `support.js` в проект не переносится. Шрифт заголовков PT Serif подключается через `next/font/google` только на страницах `/games` и `/admin`. Тесты проверяют поведение, а не внешний вид; в конце каждой задачи экраны сверяются с прототипами на 375 и 1280 px.

### Task 9: Публичные страницы

**Files:**
- Create: `lib/games/queries.ts`, `app/games/layout.tsx`, `app/games/page.tsx`, `app/games/[slug]/page.tsx`, `app/games/[slug]/opengraph-image.tsx`, компоненты в `components/games/`
- Test: `__tests__/lib/games/queries.test.ts`, `__tests__/components/games/*.test.tsx`, `e2e/mobile/game-pages.spec.ts`

**Interfaces:**
- Consumes: `buildLeaderboard`.
- Produces: `listFinishedGames(): Promise<GameSummary[]>`, `getGameBySlug(slug: string): Promise<GameDetails | null>`, `getLeaderboard(): Promise<LeaderboardRow[]>`. Имена берутся из `players` включая архивированных, поэтому запросы не используют `fetchPlayers`.

- [ ] **Step 1: Написать падающие тесты.** Незавершённые игры не показываются. Неизвестный адрес даёт 404. Каталог сортируется от новых к старым. Блоки фото, картинок и структуры скрываются при отсутствии данных. Архивированный игрок остаётся в таблице. `metadata.robots` запрещает индексацию на всех страницах `/games`.
- [ ] **Step 2:** `npx jest __tests__/lib/games/queries.test.ts __tests__/components/games`. Ожидается FAIL.
- [ ] **Step 3: Реализовать страницы по дизайну.** Сортировка таблицы — по умолчанию суммарный выигрыш, клиентская. Для `finished_at_approximate` в плитке «Финал» показывать знак `~` перед временем. Плашка «Фото с вечера появятся позже» — только если игре меньше 7 дней и фото нет. У фото с `width` и `height` задавать пропорции заранее. Карточка ссылки (`opengraph-image`) 1200×630 с вариантом без фото; для кириллицы в `next/og` явно передать файлы шрифтов.
- [ ] **Step 4:** `npx jest`, затем безопасный e2e. Ожидается PASS.

### Task 10: Админка игр и фото

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/games/[slug]/page.tsx`, `app/admin/no-game/page.tsx`, `app/admin/players/page.tsx`, `app/api/admin/games/[id]/route.ts`, `app/api/admin/games/[id]/results/route.ts`, `app/api/admin/games/[id]/images/route.ts`, `app/api/admin/photos/route.ts`, `app/api/admin/photos/[id]/route.ts`, компоненты в `components/admin/`
- Modify: `components/SettingsScreen.tsx:702-721,787-` (убрать загрузку и удаление всех фото, дать ссылку на новый раздел), `components/PlayerManager/PlayerForm.tsx` (подпись «Будет показана в следующих играх, прошедшие не изменятся»), `lib/supabase/slideshow.ts` (удалить `uploadSlideshowPhoto`, `deleteAllSlideshowPhotos`)
- Test: `__tests__/app/api/adminGames.test.ts`, `__tests__/app/api/adminPhotos.test.ts`, `__tests__/components/admin/*.test.tsx`, `e2e/desktop/admin-games.spec.ts`

**Interfaces:**
- Consumes: `isAdminRequest`, `requireAdmin`, `assignPayouts`, `validateResultPositions`, `uploadToSignedPath`, `resizeContain`, `resizeCover`.
- Produces:
  - `PATCH /api/admin/games/[id]/results { players: { id, finishPosition, rebuys, hasAddon }[] }`: проверка, пересчёт `payout`, запись одной операцией, игрок на первом месте получает `status='winner'`.
  - `DELETE /api/admin/games/[id]`: участники и игра удаляются, фото переходят в «Без игры».
  - `PATCH /api/admin/games/[id]/images { sessionPlayerId, kind, path, thumbPath }`: создаёт строку `player_images` с `is_current = false` и ссылается на неё только в этой игре.
  - `POST /api/admin/photos { sessionId, path, thumbPath, width, height, takenAt }`, `PATCH /api/admin/photos/[id] { sessionId | null }`, `DELETE /api/admin/photos/[id]`.

- [ ] **Step 1: Написать падающие тесты маршрутов.** Для всех: без cookie 401. Правка `[1,1,3]` даёт 400 без изменений в базе. Правка пересчитывает суммы, их итог равен новому банку. Удаление игры оставляет её фото с `session_id = null`. Удаление фото убирает и запись, и оба файла. Если запись не создалась, в списке карусели файла нет.
- [ ] **Step 2: Написать падающие тесты загрузки.** Из пяти файлов два не загрузились: создаются три записи, два имени показаны как неудачные, повторить можно только их. Файл HEIC получает статус ошибки с текстом «Не удалось загрузить: формат HEIC не поддерживается», остальные продолжают загружаться. Подтверждение удаления содержит текст «Фото исчезнет и со страницы игры, и из карусели». Удаление игры требует подтверждения. Кнопка ребая не позволяет превысить `maxRebuys`.
- [ ] **Step 3:** `npx jest __tests__/app/api/adminGames.test.ts __tests__/app/api/adminPhotos.test.ts __tests__/components/admin`. Ожидается FAIL.
- [ ] **Step 4: Реализовать маршруты и экраны по дизайну.** Запись результатов одной транзакцией выполнить через SQL-функцию, добавленную в новый файл `supabase/game_history_results_rpc.sql`. Загрузка: сжатие до 1920 px и миниатюра 200 px теми же параметрами качества, что в `imageVariants`, не более 3 файлов одновременно, `takenAt` из `file.lastModified`. Без входа страницы `/admin/*` переводят на `/admin/login`. Поиск и чипы лет скрываются, если игр меньше 10. На вкладке «Игроки» переиспользовать `PlayerManager`. Индексация запрещена.
- [ ] **Step 5:** `npx jest`, затем безопасный e2e. Ожидается PASS.
- [ ] **Step 6: Выкладка.** Сначала SQL-функция, затем код. На рабочем сайте загрузить фото в игру 31 октября и проверить страницу и карусель.

### Task 11: Закрыть запись через публичный ключ

Выполняется последним, после проверки всех экранов на рабочем сайте.

**Files:**
- Create: `supabase/game_history_lockdown.sql`, `supabase/game_history_cleanup.sql`
- Test: новый `scripts/verify-lockdown.mjs`, безопасный e2e. `e2e/desktop/two-tables.spec.ts` на рабочей базе не запускать.

**Interfaces:**
- Consumes: фактические правила из `pg_policies` рабочей базы.

- [ ] **Step 1: Получить текущие правила.** Владелец выполняет запрос к `pg_policies` для `sessions`, `session_players`, `players`, `storage.objects` и присылает результат. SQL пишется по этому результату, а не по предположениям.
- [ ] **Step 2: Написать SQL с разделом отката.**
  - `sessions`: `anon` может `SELECT`, `INSERT`, `UPDATE` только при `status='active'` до и после изменения, `DELETE` запрещён.
  - `session_players`: `anon` может `SELECT`, `INSERT`, `UPDATE` только в активной игре, `DELETE` запрещён.
  - `players`: `anon` может `SELECT`, `INSERT`, `UPDATE`, `DELETE` запрещён.
  - `storage.objects` для `slideshow` и `avatars`: `anon` только чтение.
  - Проверить, что `merge_tables`, `timer_state`, `timer_commands`, `minute_timer_state` и `app_config` продолжают работать.
- [ ] **Step 3: Написать `scripts/verify-lockdown.mjs`.** Скрипт читает публичный ключ из `.env.local`, пробует изменить несуществующий идентификатор в завершённой игре и загрузить файл в оба хранилища в тестовый путь, и ожидает отказ. Реальных данных он не меняет.
- [ ] **Step 4: Выкладка.** Владелец выполняет SQL. Запустить `node scripts/verify-lockdown.mjs`. Ожидается отказ на каждой проверке. Затем ручная тестовая игра на рабочем сайте от старта до завершения, с двумя столами и на телефоне. Если таймер или панель ломаются — выполнить раздел отката.
- [ ] **Step 5: Удалить резервные таблицы.** Только с подтверждения пользователя и после проверки: `game_history_cleanup.sql` удаляет `backup_20261101_*`.
