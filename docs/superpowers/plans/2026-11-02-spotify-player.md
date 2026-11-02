# Spotify-плеер на экране таймера — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** вкладка большого экрана таймера становится устройством Spotify. С неё можно искать и включать музыку, а когда играют «длинные» звуки сайта, Spotify сам встаёт на паузу.

**Architecture:** вход в Spotify через OAuth PKCE целиком в браузере, токены лежат в `localStorage`. Воспроизведение идёт через Spotify Web Playback SDK, поиск и запуск плейлиста — через Spotify Web API. `SpotifyContext` хранит плеер и «удержания» звуков сайта. Решение «поставить на паузу / продолжить» принимает чистый класс `AutoPauseController`, его покрываем юнит-тестами. Мини-плеер (вариант B) встроен в `PokerTimer`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Jest + Testing Library, Spotify Web Playback SDK (`https://sdk.scdn.co/spotify-player.js`), Spotify Web API.

**Spec:** `docs/superpowers/specs/2026-11-02-spotify-player-design.md`

## Global Constraints

- Не коммитить без явной просьбы владельца. В конце каждой задачи вместо коммита: `git status` и короткий отчёт об изменениях.
- Tailwind-классы, никаких inline `style` в новых компонентах.
- Тесты: на всю фичу максимум 3 юнит-теста, только на логику. Тестов на вид и отрисовку нет, номер версии в тестах не прописывать.
- Client ID берётся только из `process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID`. Если он пустой, плеер не рендерится, SDK не грузится, сайт работает как раньше.
- Адрес возврата после входа: `${window.location.origin}/spotify/callback`. В Spotify Dashboard регистрируются `https://bsptimer.online/spotify/callback` и `http://127.0.0.1:3000/spotify/callback`. `localhost` Spotify не принимает, поэтому локально сайт открывают по `http://127.0.0.1:3000`.
- Scopes: `streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state`.
- Название устройства в Spotify Connect: `Poker Timer`.
- Ключи `localStorage`: `spotifyAuth` (токены), `spotifyPkce` (временный verifier и state на время входа), `spotifyLastPlaylist` (последний плейлист), `spotifyVolume` (громкость 0–1, по умолчанию 0.5).
- Плеер только в `PokerTimer` (компьютер). `MobileView` не меняется.
- Версия: 6.16 → 6.17, запись в начало `CHANGELOG` в `components/SettingsScreen.tsx`, строка «Текущая версия» в `CLAUDE.md`.

## Review Focus

Тестов на это нет (лимит в 3 теста из `CLAUDE.md`). Проверить руками при ревью и на ручной проверке:
1. **Токен истёк посреди игры** (через час после входа). Музыка и кнопки продолжают работать без повторного входа, потому что `getValidAccessToken` обновляет токен заранее. SDK тоже берёт токен через `getOAuthToken` → `getValidAccessToken`.
2. **Браузер заблокировал звук сайта** (песня перерыва не запустилась, `songPaused` = true). Spotify не встаёт на паузу.
3. **Песня перерыва включена, и пользователь жмёт ▶ в мини-плеере.** Песня выключается, как кнопкой «без звука», выбор сохраняется, Spotify играет. Ни на миг не играют оба звука.
4. **Перезагрузка страницы во время перерыва.** После загрузки Spotify ещё не активен на вкладке, так что ставить на паузу нечего. Ничего не ломается, ▶ работает по общим правилам.
5. **Аккаунт без Premium или отозванный доступ** (`account_error`, `authentication_error` из SDK, 401 от API после неудачного обновления). Строка плеера показывает короткое сообщение и кнопку «Подключить заново», остальной экран работает.

---

### Task 1: Вход в Spotify (PKCE) и хранение токенов

**Files:**
- Create: `lib/spotify/auth.ts`
- Create: `app/spotify/callback/page.tsx`
- Test: `__tests__/lib/spotify/auth.test.ts`

**Interfaces:**
- Produces:
  - `type SpotifyTokens = { accessToken: string; refreshToken: string; expiresAt: number }` (`expiresAt` — мс epoch)
  - `getSpotifyClientId(): string | null`
  - `getRedirectUri(): string`
  - `startSpotifyLogin(): Promise<void>` — генерирует verifier (64 случайных символа из `[A-Za-z0-9-._~]`) и challenge (SHA-256 через `crypto.subtle`, base64url), кладёт `{ verifier, state }` в `spotifyPkce`, делает `window.location.assign` на `https://accounts.spotify.com/authorize` с `response_type=code`, `code_challenge_method=S256` и scopes из Global Constraints.
  - `completeSpotifyLogin(params: URLSearchParams): Promise<void>` — проверяет `state`, POST на `https://accounts.spotify.com/api/token` (`grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier`), сохраняет токены, удаляет `spotifyPkce`. Если что-то не так, бросает `Error` с текстом для пользователя.
  - `loadTokens(): SpotifyTokens | null`, `saveTokens(t: SpotifyTokens): void`, `clearTokens(): void`
  - `getValidAccessToken(now?: number): Promise<string | null>` — если до `expiresAt` больше 60 с, отдаёт текущий токен. Иначе делает refresh: POST `grant_type=refresh_token`, `refresh_token`, `client_id`. Сохраняет новые токены; если Spotify не вернул новый `refresh_token`, оставляет старый. Если refresh вернул не 2xx, вызывает `clearTokens()` и возвращает `null`. Одновременные вызовы делят один запрос refresh (общий промис в модуле).

- [ ] **Step 1: Написать падающий тест**

`__tests__/lib/spotify/auth.test.ts`, тест `refreshes an expiring token and keeps the old refresh token when none is returned`:
- `saveTokens({ accessToken: 'old', refreshToken: 'r1', expiresAt: 1_000_000 + 30_000 })`
- `global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new', expires_in: 3600 }) })`
- `process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = 'cid'`
- `await getValidAccessToken(1_000_000)` → `'new'`
- в `fetch` ушёл body с `grant_type=refresh_token` и `refresh_token=r1`
- `loadTokens()` → `{ accessToken: 'new', refreshToken: 'r1', expiresAt: 1_000_000 + 3_600_000 }`

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npx jest __tests__/lib/spotify/auth.test.ts`
Expected: FAIL (модуль не найден)

- [ ] **Step 3: Реализовать `lib/spotify/auth.ts` по Interfaces**

- [ ] **Step 4: Запустить тест**

Run: `npx jest __tests__/lib/spotify/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Страница `app/spotify/callback/page.tsx`**

Клиентская страница (`'use client'`). При загрузке вызывает `completeSpotifyLogin(new URLSearchParams(window.location.search))`. Если всё прошло, делает `window.location.replace('/')`. Если нет, на тёмном фоне показывает текст ошибки и ссылку «Вернуться к таймеру» (`/`). Если в адресе есть `error=access_denied`, пишет «Вход в Spotify отменён».

- [ ] **Step 6: Отчёт** — `git status`, без коммита.

---

### Task 2: Логика автопаузы

**Files:**
- Create: `lib/spotify/autoPause.ts`
- Test: `__tests__/lib/spotify/autoPause.test.ts`

**Interfaces:**
- Produces:
  - `type SiteAudioId = 'breakSong' | 'tractor' | 'finalSlideshow' | 'winnerFanfare'`
  - `type AutoPauseDeps = { isPlayingHere(): boolean; isActiveHere(): boolean; pause(): Promise<void>; resume(): Promise<void> }`
  - `class AutoPauseController`:
    - `constructor(deps: AutoPauseDeps)`
    - `hold(id: SiteAudioId): void` — добавить удержание. Если оно первое и `isPlayingHere()`, вызвать `pause()` и запомнить `pausedByUs = true`.
    - `release(id: SiteAudioId): void` — снять удержание. Если удержаний не осталось и `pausedByUs`: сбросить флаг и вызвать `resume()`, только если `isActiveHere()`.
    - `forgetPause(): void` — сбросить `pausedByUs`. Вызывается, когда пользователь сам жмёт ⏸ или запускает другой плейлист, пока есть удержания.
    - `activeHolds(): SiteAudioId[]`
    - `hold` того же id повторно и `release` id, которого нет, ничего не делают.

- [ ] **Step 1: Написать падающие тесты**

`__tests__/lib/spotify/autoPause.test.ts`, фейковые deps на `jest.fn()` с изменяемыми `playing` и `active`:
1. `pauses once for overlapping site sounds and resumes after the last one ends` — `playing = true`; `hold('breakSong')`, `hold('winnerFanfare')` → `pause` вызван 1 раз; `release('breakSong')` → `resume` не вызван; `release('winnerFanfare')` → `resume` вызван 1 раз.
2. `does not resume music the user had paused or that moved to another device` — (а) `playing = false`; `hold('tractor')`, `release('tractor')` → ни `pause`, ни `resume`. (б) `playing = true`; `hold('tractor')`; `active = false`; `release('tractor')` → `resume` не вызван.

- [ ] **Step 2: Запустить и убедиться, что падают**

Run: `npx jest __tests__/lib/spotify/autoPause.test.ts`
Expected: FAIL

- [ ] **Step 3: Реализовать `lib/spotify/autoPause.ts`**

- [ ] **Step 4: Запустить**

Run: `npx jest __tests__/lib/spotify/autoPause.test.ts`
Expected: PASS (2 теста)

- [ ] **Step 5: Отчёт** — `git status`.

---

### Task 3: Web API, SDK и `SpotifyContext`

**Files:**
- Create: `lib/spotify/api.ts`
- Create: `lib/spotify/storage.ts`
- Create: `context/SpotifyContext.tsx`
- Modify: `app/page.tsx` — обернуть `<PokerTimer />` (только десктопную ветку) в `<SpotifyProvider>`
- Modify: `package.json` — devDependency `@types/spotify-web-playback-sdk`

**Interfaces:**
- Consumes: `getValidAccessToken`, `startSpotifyLogin`, `clearTokens`, `getSpotifyClientId` (Task 1); `AutoPauseController`, `SiteAudioId` (Task 2).
- Produces:
  - `lib/spotify/api.ts`:
    - `type SpotifyPlaylistItem = { uri: string; name: string; owner: string; imageUrl: string | null }`
    - `searchPlaylists(token: string, query: string): Promise<SpotifyPlaylistItem[]>` — `GET https://api.spotify.com/v1/search?type=playlist&limit=10&q=…` (в режиме разработки Spotify больше 10 не отдаёт, на 20 отвечает 400). Пропускать `null` в `playlists.items` (Spotify их возвращает).
    - `playContext(token: string, deviceId: string, contextUri: string): Promise<void>` — `PUT https://api.spotify.com/v1/me/player/play?device_id=…` с телом `{ context_uri }`.
    - `class SpotifyApiError extends Error { status: number }` — бросается на не-2xx.
  - `lib/spotify/storage.ts`: `loadLastPlaylist(): SpotifyPlaylistItem | null`, `saveLastPlaylist(p: SpotifyPlaylistItem): void`, `loadVolume(): number`, `saveVolume(v: number): void` (ключи из Global Constraints, `try/catch` вокруг `localStorage`).
  - `context/SpotifyContext.tsx`:
    - `type SpotifyStatus = 'disabled' | 'disconnected' | 'connecting' | 'ready' | 'error'`
    - `type SpotifyTrack = { name: string; artists: string }`
    - `useSpotify(): SpotifyContextValue | null` — `null` вне провайдера.
    - `SpotifyContextValue = { status; errorMessage: string | null; track: SpotifyTrack | null; isPlaying: boolean; isActiveHere: boolean; playingElsewhere: boolean; volume: number; lastPlaylist: SpotifyPlaylistItem | null; activeHolds: SiteAudioId[]; connect(): void; disconnect(): void; togglePlay(): Promise<void>; next(): Promise<void>; previous(): Promise<void>; setVolume(v: number): void; playPlaylist(p: SpotifyPlaylistItem): Promise<void>; search(q: string): Promise<SpotifyPlaylistItem[]>; holdSiteAudio(id: SiteAudioId): void; releaseSiteAudio(id: SiteAudioId): void }`
    - `useSiteAudioHold(id: SiteAudioId, active: boolean): void` — эффект: при `active` вызывает `holdSiteAudio`, в cleanup — `releaseSiteAudio`. Вне провайдера ничего не делает.

Поведение провайдера:
- Нет Client ID → `status = 'disabled'`, ничего не грузит.
- Нет токенов → `'disconnected'`. `connect()` = `startSpotifyLogin()`.
- Есть токены → подгрузить скрипт SDK один раз (`<script src="https://sdk.scdn.co/spotify-player.js">` + `window.onSpotifyWebPlaybackSDKReady`), создать `new Spotify.Player({ name: 'Poker Timer', getOAuthToken: cb => getValidAccessToken().then(t => t && cb(t)), volume: loadVolume() })`, `connect()`. `'ready'` → сохранить `device_id`.
- `player_state_changed`: `state === null` → `isActiveHere = false`, `isPlaying = false`; если до этого вкладка была активна и играла, `playingElsewhere = true` (сбрасывается, когда вкладка снова активна или после `disconnect`). Иначе `isActiveHere = true`, `isPlaying = !state.paused`, `track` из `state.track_window.current_track`.
- Ошибки SDK: `account_error` → `'error'` и «Нужен Spotify Premium»; `authentication_error` → `clearTokens()`, `'error'` и «Подключите Spotify заново»; `initialization_error` → «Браузер не поддерживает плеер Spotify». `autoplay_failed` → `isPlaying = false` без ошибки.
- `togglePlay`, `next`, `previous`, `setVolume` → методы `player` (`togglePlay`, `nextTrack`, `previousTrack`, `setVolume` + `saveVolume`). Перед первым запуском по клику вызвать `player.activateElement()`.
- `togglePlay` и `playPlaylist`, когда Spotify ещё не активен на вкладке: если есть `lastPlaylist` (или передан плейлист), запустить через `playContext` на свой `device_id`. Если плейлиста нет, `togglePlay` ничего не делает.
- `playPlaylist` → `playContext`, `saveLastPlaylist`, `autoPause.forgetPause()`. Если пользователь ставит ⏸ при активных удержаниях → тоже `forgetPause()`.
- `AutoPauseController` создаётся один раз. `deps` читают актуальные `isPlaying` и `isActiveHere` через ref. `pause` и `resume` = `player.pause()` и `player.resume()`.
- Ошибки Web API: 401 → один повтор после `getValidAccessToken()`; 404 «нет активного устройства» → `'error'` и «Плеер ещё не готов, попробуйте ещё раз»; 403 → «Нужен Spotify Premium».
- `disconnect()` → `player.disconnect()`, `clearTokens()`, `'disconnected'`.
- Тестов в этой задаче нет: это обвязка вокруг SDK, проверяется руками (Task 6).

- [ ] **Step 1:** `npm i -D @types/spotify-web-playback-sdk` и добавить тип в `tsconfig.json` `compilerOptions.types`, если проект его задаёт (если `types` не задан, ничего не делать).
- [ ] **Step 2:** Реализовать `lib/spotify/api.ts` и `lib/spotify/storage.ts`.
- [ ] **Step 3:** Реализовать `context/SpotifyContext.tsx`.
- [ ] **Step 4:** Обернуть десктопную ветку в `app/page.tsx`: `{isMobile ? <MobileView /> : <SpotifyProvider><PokerTimer /></SpotifyProvider>}`.
- [ ] **Step 5:** Run: `npx tsc --noEmit` → без ошибок. Run: `npm test` → всё зелёное.
- [ ] **Step 6: Отчёт** — `git status`.

---

### Task 4: Мини-плеер и поиск (вариант B)

**Files:**
- Create: `components/spotify/SpotifyMiniPlayer.tsx`
- Create: `components/spotify/SpotifySearchDialog.tsx`
- Modify: `components/PokerTimer.tsx` — рендер мини-плеера

**Interfaces:**
- Consumes: `useSpotify`, `SpotifyPlaylistItem`, `SiteAudioId` (Task 3).
- Produces:
  - `SpotifyMiniPlayer(props: { canControl: boolean; controlsVisible: boolean; onPlayDuringBreakSong: () => void })`
  - `SpotifySearchDialog(props: { onClose: () => void })`

Поведение `SpotifyMiniPlayer`:
- `useSpotify()` вернул `null` или `status === 'disabled'` → `null`.
- Позиция: `fixed bottom-[18px] left-7 z-[70]`, симметрично часам справа (`ClockDisplay`). `z-[70]` — чтобы плеер был поверх всех экранов вне игры и оверлеев: окно «Игра не настроена» (`z-40`), `WinnerScreen`, `LoserImageOverlay`, `MinuteTimerOverlay`, `MergeTablesDialog` (`z-50`), `FinalGameSlideshowOverlay` (`z-[60]`). Ниже остаются только окно входа (`z-[80]`) и окно поиска (`z-[85]`). На тёмных фонах экрана победителя и слайдшоу у строки плеера полупрозрачная подложка (`bg-black/40 rounded-lg px-3 py-1.5`), чтобы текст читался. Если на `WinnerScreen` внизу слева есть свои элементы, сдвинуть плеер так, чтобы не перекрывать их, и проверить это руками.
- Плеер рендерится в `PokerTimer` безусловно: не внутри веток `!state.isOver`, `activeSession` или `showWinner`, а рядом с `<ClockDisplay />`. Тексты в тусклых серых тонах экрана (`text-[#555]` / `text-[#444]`).
- Строка трека «Исполнитель — Название» с иконкой ♫ видна всегда, когда `track && isActiveHere`. Если `playingElsewhere`, на её месте тусклое «Музыка играет на другом устройстве»; ▶ забирает музыку обратно на эту вкладку.
- Только при `canControl && controlsVisible` (та же прозрачность и `pointer-events-none`, что у кнопок в `PokerTimer`):
  - `status === 'disconnected'` → кнопка «Подключить Spotify».
  - `status === 'error'` → `errorMessage` и кнопка «Подключить заново» (`connect`).
  - `status === 'ready'` → ⏮ ⏯ ⏭, ползунок громкости (`input type="range"` 0–1, шаг 0.05), 🔍 (открывает `SpotifySearchDialog`) и маленькая ссылка «Выйти из Spotify» (`disconnect`). Пока Spotify не активен и есть `lastPlaylist`, рядом с ▶ видно его название.
- Кнопка ▶ при наличии удержаний:
  - `activeHolds` состоит только из `'breakSong'` → клик вызывает `onPlayDuringBreakSong()`, потом `togglePlay()`.
  - Есть любое другое удержание → кнопка `disabled`, рядом подсказка «Музыка продолжится сама».
- `connecting` → тусклое «Подключаем Spotify…».

`SpotifySearchDialog`: модальное окно поверх экрана (`fixed inset-0 z-[85] bg-black/60`), поле ввода с автофокусом, поиск с задержкой 400 мс после ввода, список результатов (обложка, название, автор). Клик → `playPlaylist(item)` и `onClose()`. Закрытие по Esc и клику по фону. Ошибка поиска выводится текстом в окне.

Важно для `PokerTimer`: обработчик клавиш (`Space`/`Tab` → пауза таймера) игнорирует `INPUT`, поэтому ввод в поиске таймер не трогает. Проверить это руками.

- [ ] **Step 1:** Реализовать `SpotifySearchDialog`.
- [ ] **Step 2:** Реализовать `SpotifyMiniPlayer`.
- [ ] **Step 3:** В `PokerTimer.tsx` рядом с `<ClockDisplay />` добавить `<SpotifyMiniPlayer canControl={canControl} controlsVisible={controlsVisible} onPlayDuringBreakSong={...} />`. Обработчик: если `isOnBreak && state.config.breakSongEnabled && !songPaused`, вызвать `toggleSong()`. Это тот же путь, что у кнопки «без звука», и выбор сохраняется в `pokerTimerBreakSongPaused`.
- [ ] **Step 4:** `npx tsc --noEmit` и `npm test` → зелёные.
- [ ] **Step 5: Отчёт** — `git status`.

---

### Task 5: Подключить звуки сайта к автопаузе

**Files:**
- Modify: `components/PokerTimer.tsx`
- Modify: `lib/audio.ts` — `playWinnerFanfare`
- Modify: `components/WinnerScreen/WinnerScreen.tsx`

**Interfaces:**
- Consumes: `useSiteAudioHold` (Task 3).
- Produces: `playWinnerFanfare(onEnd?: () => void): { stop: () => void }` — `onEnd` вызывается один раз: по событию `ended`, при `stop()` или если `play()` отклонён браузером.

- [ ] **Step 1:** В `PokerTimer.tsx` после `useBreakSong(...)`:
  - `useSiteAudioHold('breakSong', isOnBreak && state.config.breakSongEnabled && !songPaused)` — если браузер не дал включить песню, `useBreakSong` выставляет `songPaused`, и удержания нет.
  - `useSiteAudioHold('tractor', state.tractorMomentActive && !state.isOver)` — весь «момент с трактором», независимо от паузы таймера.
  - `useSiteAudioHold('finalSlideshow', showWinner && finalSlideshowVisible)`.
- [ ] **Step 2:** `lib/audio.ts`: добавить `onEnd` в `playWinnerFanfare` по Interfaces.
- [ ] **Step 3:** `WinnerScreen.tsx`: состояние `fanfarePlaying` (стартует `true` при запуске фанфар, `false` в `onEnd`); `useSiteAudioHold('winnerFanfare', fanfarePlaying)`.
- [ ] **Step 4:** `npx tsc --noEmit` и `npm test` → зелёные.
- [ ] **Step 5: Отчёт** — `git status`.

---

### Task 6: Версия, инструкция для владельца, ручная проверка

**Files:**
- Modify: `components/SettingsScreen.tsx` — первой записью в `CHANGELOG`: `{ version: '6.17', date: "02 Nov '26", notes: 'Музыка из Spotify прямо на экране таймера: поиск, плейлисты, громкость. Во время песни перерыва и других звуков сайта Spotify сам встаёт на паузу.' }` (дату поставить фактическую, в том же формате)
- Modify: `CLAUDE.md` — «Текущая версия: **6.17**»
- Create: `docs/spotify-setup.md` — инструкция для владельца

- [ ] **Step 1: `docs/spotify-setup.md`** — пошагово, простым языком:
  1. Открыть https://developer.spotify.com/dashboard, войти своим аккаунтом Premium, принять условия.
  2. Create app: название «Poker Timer», описание любое. Redirect URIs: `https://bsptimer.online/spotify/callback` и `http://127.0.0.1:3000/spotify/callback`. Отметить «Web API» и «Web Playback SDK». Сохранить.
  3. В Settings → User Management добавить свой email Spotify (и email тех, кто ещё будет входить; до 25 человек).
  4. Скопировать Client ID (он не секретный).
  5. Добавить его на Vercel как `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` для Production и Preview (Project → Settings → Environment Variables) и локально в `.env.local`. После добавления на Vercel нужен новый деплой.
  6. Локально открывать сайт по `http://127.0.0.1:3000`, а не `localhost`.
- [ ] **Step 2:** Обновить `CHANGELOG` и `CLAUDE.md`.
- [ ] **Step 3:** `npm test` и `npx tsc --noEmit` → зелёные. `npm run build` → успешно.
- [ ] **Step 4: Ручная проверка** (нужен Client ID в `.env.local`; без него проверить, что плеер не появляется и сайт работает как раньше). На `http://127.0.0.1:3000`, войдя в управление:
  - «Подключить Spotify» → вход → возврат на таймер, строка «Подключаем…» сменяется кнопками.
  - Поиск «jazz» → клик по плейлисту → играет во вкладке; в приложении Spotify на телефоне устройство называется «Poker Timer».
  - ⏮ ⏯ ⏭ и громкость работают; пробел в поле поиска не ставит таймер на паузу.
  - Перерыв (кнопка ⏭ таймера до перерыва) → Spotify встаёт на паузу, играет песня → кнопка «без звука» → Spotify продолжает → снова включить песню → Spotify на паузе → ▶ в мини-плеере → песня выключается, Spotify играет.
  - Вне игры: без активной сессии (окно «Игра не настроена»), на экране победителя, на «Tournament Over» и во время финального слайдшоу плеер виден поверх. Кнопки появляются при движении мыши, поиск и запуск плейлиста работают (кроме ▶ во время музыки слайдшоу).
  - Перезагрузить страницу → вход сохранён, рядом с ▶ название последнего плейлиста, ▶ запускает его.
  - «Выйти из Spotify» → кнопка «Подключить Spotify».
  - Пункты из Review Focus, которые можно воспроизвести.
- [ ] **Step 5: Отчёт владельцу** — что сделано, что проверено, что нет. Не коммитить, спросить разрешения.
