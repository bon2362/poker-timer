# Poker Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать один HTML-файл `poker-timer.html`, который открывается в Chrome на Windows и работает как покерный таймер — блайнды, перерывы, пауза, звук.

**Architecture:** Один самодостаточный HTML-файл без внешних зависимостей. Весь CSS внутри `<style>`, весь JS внутри `<script>`. Состояние — глобальные JS-переменные. Рендеринг — DOM-манипуляции через `getElementById`.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES6), Web Audio API

---

## File Structure

```
poker-timer.html   ← единственный файл, всё приложение
```

Внутренняя структура файла (секции JS):
- `BLIND_LEVELS` — массив 14 уровней `{sb, bb}`
- `stages` — плоский массив всех этапов `{type, sb?, bb?, duration, label}`
- State: `currentStage`, `timeLeft`, `isPaused`, `timerId`
- `tick()` — функция, вызываемая каждую секунду
- `render()` — обновляет весь DOM по текущему state
- `playBeep(count)` — Web Audio API звук
- Кнопки: `togglePause()`, `prevStage()`, `nextStage()`, `resetStage()`, `goToLast()`

---

## Task 1: Проект и HTML-скелет

**Files:**
- Create: `poker-timer.html`

- [ ] **Шаг 1: Инициализировать git**

```bash
cd /Users/ekoshkin/poker
git init
```

- [ ] **Шаг 2: Создать `poker-timer.html` со скелетом**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Poker Timer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #1a1a1a;
      color: #fff;
      font-family: Arial, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }

    /* TOP BAR */
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 28px 0;
    }
    .corner-btn {
      background: none;
      border: none;
      color: #555;
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      width: 32px;
    }
    .level-info { text-align: center; flex: 1; }
    .level-label {
      font-size: 13px;
      color: #888;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .blinds-current { font-size: 28px; font-weight: 700; }

    /* TIMER */
    .timer-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .timer {
      font-size: clamp(140px, 22vw, 240px);
      font-weight: 900;
      letter-spacing: -4px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    /* PROGRESS BAR */
    .progress-wrap { padding-bottom: 6px; }
    .progress-bar { height: 3px; background: #333; }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: #7c3aed;
      transition: width 0.9s linear;
    }

    /* BOTTOM */
    .bottom {
      padding: 8px 28px 18px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .next-info { font-size: 13px; color: #888; letter-spacing: 1px; }
    .next-info strong { color: #aaa; }

    /* CONTROLS */
    .controls { display: flex; gap: 10px; align-items: center; }
    .btn {
      background: #7c3aed;
      border: none;
      color: #fff;
      border-radius: 8px;
      width: 44px;
      height: 38px;
      font-size: 15px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn:hover { background: #6d28d9; }
    .btn-ghost { background: #2a2a2a; }
    .btn-ghost:hover { background: #383838; }
    .btn-lg { width: 52px; height: 42px; font-size: 18px; }

    /* BREAK SCREEN */
    body.is-break .timer { color: #60a5fa; }
    body.is-break .progress-fill { background: #2563eb; }

    /* PAUSED STATE */
    body.is-paused .timer { opacity: 0.6; }

    /* END SCREEN */
    .end-screen {
      display: none;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .end-screen h1 { font-size: 48px; font-weight: 900; color: #7c3aed; }
    .end-screen p { color: #888; font-size: 18px; }
    body.is-over .end-screen { display: flex; }
    body.is-over .timer-wrap,
    body.is-over .progress-wrap,
    body.is-over .bottom { display: none; }
  </style>
</head>
<body>

  <div class="top">
    <button class="corner-btn" title="Restart" onclick="restartTournament()">↺</button>
    <div class="level-info">
      <div class="level-label" id="levelLabel">Round 1</div>
      <div class="blinds-current" id="blindsCurrent">10 / 20</div>
    </div>
    <button class="corner-btn" style="visibility:hidden;">⚙</button>
  </div>

  <div class="timer-wrap">
    <div class="timer" id="timer">20:00</div>
  </div>

  <div class="end-screen">
    <h1>Tournament Over</h1>
    <p>Хорошая игра!</p>
    <button class="btn" style="width:auto;padding:0 24px;height:44px;font-size:15px;" onclick="restartTournament()">↺ Начать заново</button>
  </div>

  <div class="progress-wrap">
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill"></div>
    </div>
  </div>

  <div class="bottom">
    <div class="next-info" id="nextInfo">Next: 20 / 40</div>
    <div class="controls">
      <button class="btn btn-ghost" title="В начало уровня" onclick="resetStage()">⏮</button>
      <button class="btn" title="Предыдущий уровень" onclick="prevStage()">⏪</button>
      <button class="btn btn-lg" id="pauseBtn" onclick="togglePause()">▶</button>
      <button class="btn" title="Следующий уровень" onclick="nextStage()">⏩</button>
      <button class="btn btn-ghost" title="Последний уровень" onclick="goToLast()">⏭</button>
    </div>
  </div>

  <script>
    // JS будет добавлен в следующих задачах
  </script>
</body>
</html>
```

- [ ] **Шаг 3: Открыть в Chrome и убедиться, что тёмный экран отображается корректно**

Ожидаем: тёмный фон `#1a1a1a`, текст на экране, кнопки внизу. Таймер статичный (20:00), кнопки кликабельны (ошибки в консоли — нормально на этом шаге).

- [ ] **Шаг 4: Закоммитить**

```bash
git add poker-timer.html
git commit -m "feat: HTML skeleton with layout and styles"
```

---

## Task 2: Данные — структура блайндов и массив этапов

**Files:**
- Modify: `poker-timer.html` (секция `<script>`)

- [ ] **Шаг 1: Заменить `<script>` содержимое на данные**

Заменить `// JS будет добавлен в следующих задачах` на:

```js
// ─── DATA ───────────────────────────────────────────────────────────────────

const BLIND_LEVELS = [
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
  { sb: 1000,bb: 2000 },
];

const LEVEL_DURATION = 20 * 60; // 1200 секунд
const BREAK_DURATION = 10 * 60; // 600 секунд
const BREAK_EVERY    = 2;       // перерыв после каждых N уровней

// Строим плоский массив этапов: уровни + перерывы
// Структура: Level 1, Level 2, Break, Level 3, Level 4, Break, ...
// Перерыва после последнего уровня нет
function buildStages() {
  const result = [];
  for (let i = 0; i < BLIND_LEVELS.length; i++) {
    const levelNum = i + 1;
    result.push({
      type: 'level',
      levelNum,
      sb: BLIND_LEVELS[i].sb,
      bb: BLIND_LEVELS[i].bb,
      duration: LEVEL_DURATION,
    });
    const isLast = levelNum === BLIND_LEVELS.length;
    if (levelNum % BREAK_EVERY === 0 && !isLast) {
      result.push({ type: 'break', duration: BREAK_DURATION });
    }
  }
  return result;
}

const stages = buildStages();
// stages: 14 уровней + 6 перерывов = 20 этапов
```

- [ ] **Шаг 2: Проверить в консоли браузера**

Открыть DevTools → Console и выполнить:
```js
console.table(stages)
```
Ожидаем: 20 строк, чередование `level` и `break`, первый `break` после levelNum 2.

- [ ] **Шаг 3: Закоммитить**

```bash
git add poker-timer.html
git commit -m "feat: blind structure data and stages array"
```

---

## Task 3: Состояние и движок таймера

**Files:**
- Modify: `poker-timer.html` (секция `<script>`, после данных)

- [ ] **Шаг 1: Добавить state и функцию `tick()`**

Добавить после блока данных:

```js
// ─── STATE ──────────────────────────────────────────────────────────────────

let currentStage = 0;
let timeLeft     = stages[0].duration;
let isPaused     = true;
let timerId      = null;
let warnedOneMin = false; // флаг: предупреждение за 1 мин уже сыграно

// ─── TIMER ENGINE ───────────────────────────────────────────────────────────

function tick() {
  if (isPaused) return;

  // Предупреждение за 60 секунд (только для уровней, не для перерывов)
  if (timeLeft === 61 && stages[currentStage].type === 'level' && !warnedOneMin) {
    warnedOneMin = true;
    playBeep(1);
  }

  timeLeft--;

  if (timeLeft <= 0) {
    advanceStage();
    return;
  }

  render();
}

function advanceStage() {
  const nextIdx = currentStage + 1;
  if (nextIdx >= stages.length) {
    // Турнир окончен
    clearInterval(timerId);
    timerId  = null;
    isPaused = true;
    document.body.classList.add('is-over');
    return;
  }

  const wasBreak = stages[currentStage].type === 'break';
  currentStage  = nextIdx;
  timeLeft      = stages[currentStage].duration;
  warnedOneMin  = false;

  // Звук при переходе
  if (stages[currentStage].type === 'break') {
    playBeep(2); // двойной beep → перерыв
  } else if (wasBreak) {
    playBeep(3); // тройной beep → конец перерыва
  } else {
    playBeep(2); // двойной beep → новый уровень
  }

  render();
}

function togglePause() {
  if (document.body.classList.contains('is-over')) return;
  isPaused = !isPaused;
  render();
}

function resetStage() {
  timeLeft     = stages[currentStage].duration;
  warnedOneMin = false;
  render();
}

function prevStage() {
  if (currentStage > 0) {
    currentStage--;
    timeLeft     = stages[currentStage].duration;
    warnedOneMin = false;
    render();
  }
}

function nextStage() {
  if (currentStage < stages.length - 1) {
    currentStage++;
    timeLeft     = stages[currentStage].duration;
    warnedOneMin = false;
    render();
  }
}

function goToLast() {
  currentStage = stages.length - 1;
  timeLeft     = stages[currentStage].duration;
  warnedOneMin = false;
  render();
}

function restartTournament() {
  clearInterval(timerId);
  currentStage = 0;
  timeLeft     = stages[0].duration;
  isPaused     = true;
  warnedOneMin = false;
  timerId      = null;
  document.body.classList.remove('is-over', 'is-break', 'is-paused');
  render();
}

// Запуск интервала (1 раз при загрузке страницы)
timerId = setInterval(tick, 1000);
```

- [ ] **Шаг 2: Проверить в консоли**

```js
// Убедиться, что state существует
console.log({ currentStage, timeLeft, isPaused })
// Ожидаем: { currentStage: 0, timeLeft: 1200, isPaused: true }
```

- [ ] **Шаг 3: Закоммитить**

```bash
git add poker-timer.html
git commit -m "feat: timer state and engine (tick, advance, controls)"
```

---

## Task 4: Функция рендеринга

**Files:**
- Modify: `poker-timer.html` (секция `<script>`, после engine)

- [ ] **Шаг 1: Добавить вспомогательные функции и `render()`**

Добавить перед строкой `timerId = setInterval(tick, 1000);`:

```js
// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNextInfo() {
  const next = stages[currentStage + 1];
  if (!next) return 'Финал турнира';

  if (next.type === 'break') {
    // После перерыва — следующий уровень
    const afterBreak = stages[currentStage + 2];
    const afterStr = afterBreak ? ` → потом ${afterBreak.sb} / ${afterBreak.bb}` : '';
    return `☕ Перерыв 10 мин${afterStr}`;
  }

  if (next.type === 'level') {
    if (stages[currentStage].type === 'break') {
      return `Следующий уровень: ${next.sb} / ${next.bb}`;
    }
    return `Далее: ${next.sb} / ${next.bb}`;
  }

  return '';
}

// ─── RENDER ─────────────────────────────────────────────────────────────────

function render() {
  const stage = stages[currentStage];

  // body классы
  document.body.classList.toggle('is-break',  stage.type === 'break');
  document.body.classList.toggle('is-paused', isPaused);

  // Кнопка паузы
  document.getElementById('pauseBtn').textContent = isPaused ? '▶' : '⏸';

  // Таймер
  document.getElementById('timer').textContent = formatTime(timeLeft);

  // Прогресс-бар (доля прошедшего времени)
  const elapsed  = stage.duration - timeLeft;
  const pct      = (elapsed / stage.duration) * 100;
  document.getElementById('progressFill').style.width = pct + '%';

  // Верхняя строка
  if (stage.type === 'level') {
    document.getElementById('levelLabel').textContent    = `Round ${stage.levelNum}`;
    document.getElementById('blindsCurrent').textContent = `${stage.sb} / ${stage.bb}`;
  } else {
    document.getElementById('levelLabel').textContent    = '☕ Break';
    document.getElementById('blindsCurrent').textContent = 'Перерыв';
  }

  // Нижняя строка "Next:"
  document.getElementById('nextInfo').innerHTML =
    `<strong>Next:</strong> ${getNextInfo()}`;
}

// Первый рендер при загрузке
render();
```

- [ ] **Шаг 2: Открыть в браузере и проверить**

- Таймер показывает `20:00`
- Верх: `Round 1` / `10 / 20`
- Низ: `Next: Далее: 20 / 40`
- Кнопка ▶ в центре

- [ ] **Шаг 3: Нажать ▶ и дождаться 2-3 секунд**

Ожидаем: таймер тикает (`19:57`, `19:56`...), кнопка стала ⏸, прогресс-бар чуть вырос.

- [ ] **Шаг 4: Нажать ⏸, затем ⏩**

Ожидаем: переход на Round 2 (20/40), таймер сброшен в 20:00.

- [ ] **Шаг 5: Нажать ⏩ ещё раз**

Ожидаем: экран перерыва — body класс `is-break`, таймер голубой, верх показывает `☕ Break`.

- [ ] **Шаг 6: Закоммитить**

```bash
git add poker-timer.html
git commit -m "feat: render function — timer display, progress bar, next info"
```

---

## Task 5: Звук через Web Audio API

**Files:**
- Modify: `poker-timer.html` (секция `<script>`, в начало перед `// ─── DATA`)

- [ ] **Шаг 1: Добавить `playBeep()` перед блоком DATA**

```js
// ─── AUDIO ──────────────────────────────────────────────────────────────────

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep(count = 1, freq = 880, duration = 0.15) {
  const ctx = getAudioCtx();
  const gap = 0.1; // пауза между beep-ами

  for (let i = 0; i < count; i++) {
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type      = 'sine';
    osc.frequency.value = freq;

    const start = ctx.currentTime + i * (duration + gap);
    const end   = start + duration;

    gain.gain.setValueAtTime(0.4, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);

    osc.start(start);
    osc.stop(end);
  }
}
```

- [ ] **Шаг 2: Проверить звук в браузере**

Открыть DevTools Console и выполнить:
```js
playBeep(1)  // один beep
playBeep(2)  // двойной
playBeep(3)  // тройной
```
Ожидаем: слышим чёткие beep-ы. Если тишина — проверить, что Chrome не заблокировал AudioContext (нужно кликнуть на странице перед вызовом).

- [ ] **Шаг 3: Убедиться, что звук срабатывает при смене уровня**

Нажать ▶, затем кнопку ⏩ — должен быть двойной beep.

- [ ] **Шаг 4: Закоммитить**

```bash
git add poker-timer.html
git commit -m "feat: Web Audio API beeps for level change and 1-min warning"
```

---

## Task 6: Финальная проверка всех сценариев

**Files:**
- Modify: `poker-timer.html` (финальные правки по результатам проверки)

- [ ] **Шаг 1: Пройти полный сценарий игры**

Проверить чек-лист вручную:

| Сценарий | Ожидание |
|----------|----------|
| Открыть файл | Таймер стоит на паузе, Round 1, 10/20, 20:00 |
| Нажать ▶ | Таймер пошёл |
| ⏸ | Таймер встал, opacity снизилась |
| ⏮ | Время сброшено в 20:00 |
| ⏪ из Round 1 | Ничего не происходит (уже первый) |
| ⏩ до Round 2 → ⏩ | Перерыв: синий таймер, ☕ Break, двойной beep |
| ⏩ из перерыва | Round 3, тройной beep |
| ⏭ | Последний уровень (Round 14, 1000/2000) |
| Дождаться конца (или вручную через DevTools: `timeLeft = 1; isPaused = false`) | "Tournament Over" экран |
| Кнопка "Начать заново" | Возврат к Round 1, 20:00, на паузе |

- [ ] **Шаг 2: Проверить 1-минутное предупреждение**

```js
// В консоли браузера во время работы таймера
timeLeft = 62; warnedOneMin = false;
```
Ожидаем: через ~2 секунды — одиночный beep.

- [ ] **Шаг 3: Закоммитить финальную версию**

```bash
git add poker-timer.html
git commit -m "feat: complete poker timer — all scenarios verified"
```

---

## Self-Review

**Spec coverage:**
- ✅ Texas Hold'em, 10 max — контекст в комментариях, не влияет на код
- ✅ 14 уровней блайндов из скриншота — в `BLIND_LEVELS`
- ✅ 20 минут на уровень — `LEVEL_DURATION = 20 * 60`
- ✅ Перерыв каждые 2 уровня, 10 минут — `buildStages()` + `BREAK_EVERY = 2`
- ✅ Пауза / старт — `togglePause()`
- ✅ Большой таймер в центре — CSS `clamp(140px, 22vw, 240px)`
- ✅ Что дальше (блайнды или перерыв) — `getNextInfo()`
- ✅ Текущие и следующие блайнды — top bar + next info
- ✅ Звук при смене уровня и перед перерывом — `playBeep()` в `advanceStage()` и `tick()`
- ✅ Конец турнира — `is-over` класс + "Tournament Over" экран

**Placeholders:** нет

**Type consistency:** все функции (`render`, `tick`, `playBeep`, `formatTime`, `getNextInfo`, `advanceStage`, `togglePause`, `resetStage`, `prevStage`, `nextStage`, `goToLast`, `restartTournament`) определены до использования или вызываются через onclick. Нет перекрёстных зависимостей.
