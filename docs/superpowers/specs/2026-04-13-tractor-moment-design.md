# Tractor Moment — Design Spec

**Date:** 2026-04-13  
**Issue:** [#82 — Блайнды 300](https://github.com/bon2362/poker-timer/issues/82)  
**Version bump:** 4.38 → 4.39

---

## Context

В покерном таймере существует культурная традиция: уровень блайндов 150/300 сопровождается юмористическим "тракторным" сюрпризом. За одну минуту до начала этого уровня запускается звук трактора (первые 30 сек), затем к нему добавляется полноэкранное зацикленное видео с тракторами (следующие 30 сек). Стандартные звуки предупреждения в этот момент подавляются. Фича используется постоянно — при каждом турнире, где есть уровень BB=300.

---

## Trigger

Момент активируется **однократно** когда:
- Текущая стадия — `level`
- Следующая стадия — `level` с `bb === 300`
- `timeLeft` пересекает порог 60 секунд (переход `> 60` → `<= 60`)
- `warnedOneMin === false` (стандартный механизм защиты от повторного срабатывания)

Если в конфиге нет уровня с BB=300 — фича молча не активируется.

---

## Sequence

```
timeLeft = 60s  → tractorMomentActive = true, стандартный warnBlinds подавлен
                   аудио /audio/tractor.mp3 начинает играть (loop)
                   tick-звуки последних 5 сек тоже подавлены

timeLeft = 30s  → видео /video/tractor.mp4 появляется (fullscreen overlay, loop, muted)
                   аудио продолжает играть

timeLeft = 0s   → стадия меняется, tractorMomentActive = false
                   TractorOverlay размонтируется, аудио/видео останавливаются
```

**Пауза:** при `isPaused = true` аудио и видео ставятся на паузу. При возобновлении — продолжают с того места. `timeLeft` замерзает — фаза (audio-only vs audio+video) тоже.

**Перемотка стадии:** любой `NEXT_STAGE` / `PREV_STAGE` / `RESET_STAGE` сбрасывает `tractorMomentActive = false`, оверлей размонтируется.

**Открытие настроек:** `OPEN_SETTINGS` выставляет `isPaused = true` → аудио/видео паузятся. `tractorMomentActive` сохраняется. При закрытии настроек пользователь вручную возобновляет таймер.

**Мобильная версия:** фича работает только в desktop (`PokerTimer.tsx`). `MobileView` не затронут.

---

## Files Changed

### 1. `types/timer.ts`
Добавить поле в `TimerState`:
```typescript
tractorMomentActive: boolean;
```

### 2. `reducer/timerReducer.ts`

**В `TICK`** — блок 1-минутного предупреждения (строки 52–61):
```typescript
if (cur.type === 'level' && !isLastStage) {
  if (nxt?.type === 'level' && nxt.bb === 300) {
    // Tractor moment: suppress standard warning, set flag
    tractorMomentActive = true;
    pendingSound = null;
  } else {
    pendingSound = nxt?.type === 'break' ? 'warnBreak' : 'warnBlinds';
  }
}
```

**Подавление tick-звуков:**
```typescript
if (newTimeLeft <= 5 && newTimeLeft > 0 && !pendingSound && !tractorMomentActive) {
  pendingSound = 'tick';
}
```

**Сброс флага** во всех actions, меняющих стадию (по аналогии с `warnedOneMin`):
- `advanceStage()` — добавить `tractorMomentActive: false`
- `NEXT_STAGE`, `PREV_STAGE`, `RESET_STAGE`, `GO_TO_LAST`, `RESTART`, `SAVE_SETTINGS`, `RESTORE_STATE` — добавить `tractorMomentActive: false`

Начальное значение в initial state: `tractorMomentActive: false`.

### 3. `components/TractorOverlay.tsx` *(новый файл)*

```typescript
type Props = {
  timeLeft: number;
  isPaused: boolean;
};
```

- `audioRef = useRef<HTMLAudioElement>` → `<audio src="/audio/tractor.mp3" loop />`
- `videoRef = useRef<HTMLVideoElement>` → `<video src="/video/tractor.mp4" loop muted />`
- При монтировании: `audioRef.current.play()`
- `useEffect([isPaused])`: `isPaused ? audio.pause() : audio.play()`
- `showVideo = timeLeft <= 30`
- `useEffect([showVideo, isPaused])`: когда `showVideo` становится true и `!isPaused` → `video.play()`; при паузе → `video.pause()`
- Вёрстка: `fixed inset-0 z-20 bg-black` + `<video className="w-full h-full object-cover">`
- `z-20` — ниже Controls (`z-30`), поэтому кнопки управления остаются видимыми поверх оверлея без изменения их z-index
- Видео появляется с `opacity-0 → opacity-100` через `transition-opacity duration-1000`

### 4. `components/PokerTimer.tsx`

Добавить монтирование оверлея (после `SlideshowOverlay`, перед `MinuteTimerOverlay`):
```tsx
{state.tractorMomentActive && !state.isOver && (
  <TractorOverlay timeLeft={state.timeLeft} isPaused={state.isPaused} />
)}
```

Controls уже находится на `z-30` — изменений не требуется. TractorOverlay на `z-20` отобразится под Controls, кнопки управления остаются доступными.

### 5. `reducer/initialState.ts`

Добавить `tractorMomentActive: false` в объект, возвращаемый `createInitialState()`.

### 6. Статические ресурсы

| Откуда | Куда |
|--------|------|
| `mp3/tractor.mp3` | `public/audio/tractor.mp3` |
| `mp4/invideo-ai-1080 10 Tractor Heroes_ Wheatfield Walk 2026-04-12.mp4` | `public/video/tractor.mp4` |

---

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| Нет уровня BB=300 в конфиге | Фича не активируется |
| Два уровня BB=300 | Эффект срабатывает перед каждым |
| Перезагрузка страницы при `timeLeft <= 60` перед 300 | `RESTORE_STATE` не выставляет флаг — момент не восстанавливается (допустимо) |
| Пользователь перематывает стадию вперёд/назад | Флаг сбрасывается, оверлей исчезает |
| Открытие настроек во время момента | isPaused → аудио/видео паузятся, момент ждёт |

---

## Verification

1. `npm run dev` — запустить локально
2. В настройках убедиться что 7-й уровень имеет BB=300
3. Перейти на уровень перед 150/300, нажать "1:05" (jump to end) → таймер прыгает к ~65 сек
4. Через несколько секунд: слышен звук трактора ✓
5. На отметке ~30 сек: появляется видео поверх экрана, контролы доступны ✓
6. Нажать паузу: аудио и видео останавливаются ✓
7. Возобновить: продолжают воспроизведение ✓
8. Нажать "следующая стадия": оверлей исчезает, нет артефактов ✓
9. `npm test` — существующие тесты не падают ✓
