# План: Слайдшоу фотографий во время перерывов

## Context

Пользователь хочет показывать фотографии из локальной галереи (500+ фото) во время перерывов между уровнями в покерном таймере. Фото хранятся в отдельной папке рядом с HTML-файлом на Windows-компьютере. Приложение запускается как `file://` в Chrome.

Слайдшоу должно:
- Автоматически запускаться при начале перерыва и останавливаться когда перерыв заканчивается
- Показывать полноэкранное фото с обратным отсчётом перерыва поверх
- Листать фото в случайном порядке каждые N секунд (настраивается)

## Критический файл

`/Users/ekoshkin/poker/poker-timer.html` — единственный файл, все изменения только в нём.

---

## Шаги реализации

### 1. Config — новые поля

В `DEFAULT_CONFIG` добавить:
```js
slideshowEnabled: true,
slideshowSpeed: 5,  // секунды между фото
```

### 2. CSS — новый блок `/* SLIDESHOW */`

Добавить перед `</style>`:
```css
#slideshow-overlay {
  display: none; position: fixed; inset: 0; z-index: 100; background: #000;
}
body.slideshow-active #slideshow-overlay { display: block; }
#slideshow-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: opacity 0.5s ease; }
#slideshow-img.fading { opacity: 0; }
#slideshow-badge {
  position: absolute; bottom: 24px; left: 32px;
  font-size: clamp(48px, 8vw, 96px); font-weight: 900;
  font-variant-numeric: tabular-nums; letter-spacing: -2px;
  color: rgba(255,255,255,0.85);
  text-shadow: 0 2px 16px rgba(0,0,0,0.8);
  pointer-events: none;
}
```

### 3. HTML — новые элементы

**A. Оверлей слайдшоу** — добавить перед `#clock`:
```html
<div id="slideshow-overlay">
  <img id="slideshow-img" alt="">
  <div id="slideshow-badge"></div>
</div>
```

**B. Секция в настройках** — добавить после секции «Отображение»:
```html
<div>
  <div class="settings-section-title">Слайдшоу на перерыве</div>
  <label style="display:flex;align-items:center;gap:12px;cursor:pointer;background:#242424;border-radius:8px;padding:12px 14px;">
    <input type="checkbox" id="cfg-slideshow-enabled" style="width:18px;height:18px;accent-color:#7c3aed;cursor:pointer;"
      onchange="config.slideshowEnabled = this.checked; saveConfig(config);">
    <span style="font-size:14px;color:#ccc;">Показывать фото во время перерыва</span>
  </label>
  <div class="settings-fields-row" style="margin-top:10px;">
    <div class="settings-field">
      <label>Смена фото каждые</label>
      <div class="settings-field-row">
        <input id="cfg-slideshow-speed" type="number" min="1" max="60">
        <span class="settings-field-unit">сек</span>
      </div>
    </div>
    <div class="settings-field" style="flex:2;">
      <label>Папка с фото</label>
      <button class="sound-test-btn" style="margin-top:6px;width:100%;flex-direction:row;gap:8px;" onclick="selectPhotosFolder()">
        <span>🖼</span>
        <span id="photos-folder-label" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Не выбрана</span>
      </button>
    </div>
  </div>
</div>
```

`slideshowEnabled` применяется мгновенно (через `onchange`, как `showCombos`).
`slideshowSpeed` сохраняется кнопкой «Сохранить» (как остальные временны́е параметры).

### 4. JS — новые переменные состояния

```js
let slideshowFiles    = [];    // FileSystemFileHandle[]
let slideshowShuffled = [];    // перетасованные индексы
let slideshowIndex    = 0;
let slideshowTimerId  = null;  // setInterval для смены фото
let slideshowBlobUrl  = null;  // текущий blob URL (для revokeObjectURL)
let photosFolderName  = '';
```

### 5. JS — новые функции (блок `// ─── SLIDESHOW ───`)

**`shuffleArray(arr)`** — Fisher-Yates shuffle, возвращает новый массив.

**`selectPhotosFolder()`** — async:
- Вызывает `showDirectoryPicker({ mode: 'read' })`
- Перебирает `handle.values()`, фильтрует по расширению (`jpg/jpeg/png/webp/gif/avif/bmp`)
- Сохраняет в `slideshowFiles`, обновляет `#photos-folder-label`
- При ошибке `AbortError` — тихий выход (пользователь отменил)

**`startSlideshow()`**:
- Выходит если `!config.slideshowEnabled || slideshowFiles.length === 0`
- Перетасовывает индексы, `slideshowIndex = 0`
- Добавляет `body.slideshow-active`
- Вызывает `showSlideshowPhoto()`
- `slideshowTimerId = setInterval(advanceSlideshowPhoto, slideshowSpeed * 1000)`

**`stopSlideshow()`**:
- `clearInterval(slideshowTimerId); slideshowTimerId = null`
- Убирает `body.slideshow-active`
- `URL.revokeObjectURL(slideshowBlobUrl); slideshowBlobUrl = null`

**`showSlideshowPhoto()`** — async:
- `fileHandle.getFile()` → `URL.createObjectURL(file)`
- Добавляет `.fading` на `#slideshow-img`, через 500ms меняет `src` и убирает `.fading`
- Revoke предыдущего `slideshowBlobUrl`
- При ошибке — вызывает `advanceSlideshowPhoto()` (пропускает файл)

**`advanceSlideshowPhoto()`**:
- `slideshowIndex = (slideshowIndex + 1) % slideshowShuffled.length`
- Вызывает `showSlideshowPhoto()`

### 6. Изменения существующих функций

**`advanceStage()`** — добавить вызовы старта/стопа:
```js
if (stages[currentStage].type === 'break') {
  playSound('breakStart');
  startSlideshow();   // ← NEW
} else if (wasBreak) {
  playSound('breakOver');
  stopSlideshow();    // ← NEW
}
```

**`render()`** — добавить три блока:
```js
// Обновление бейджа с таймером поверх фото
if (document.body.classList.contains('slideshow-active')) {
  document.getElementById('slideshow-badge').textContent = formatTime(timeLeft);
}

// Синхронизация при ручной навигации кнопками ⏪/⏩
const onBreak = stage.type === 'break';
if (onBreak && !slideshowTimerId && config.slideshowEnabled && slideshowFiles.length > 0) {
  startSlideshow();
}
if (!onBreak && slideshowTimerId) {
  stopSlideshow();
}
```

**`openSettings()`** — заполнить новые поля:
```js
document.getElementById('cfg-slideshow-enabled').checked = config.slideshowEnabled !== false;
document.getElementById('cfg-slideshow-speed').value = config.slideshowSpeed || 5;
// обновить label папки
const lbl = document.getElementById('photos-folder-label');
lbl.textContent = slideshowFiles.length > 0
  ? `${photosFolderName} (${slideshowFiles.length} фото)`
  : 'Не выбрана';
```

**`saveSettings()`** — добавить в объект `config`:
```js
slideshowEnabled: config.slideshowEnabled,
slideshowSpeed: Math.max(1, parseInt(document.getElementById('cfg-slideshow-speed').value) || 5),
```

**`resetToDefaults()`** — добавить:
```js
document.getElementById('cfg-slideshow-enabled').checked = true;
document.getElementById('cfg-slideshow-speed').value = 5;
```

**`restartTournament()`** — добавить:
```js
stopSlideshow();
```

### 7. Версия

Обновить 3.19 → 3.20 в HTML и CLAUDE.md.

---

## Деградация при отсутствии папки

- `slideshowFiles.length === 0` → `startSlideshow()` сразу возвращается, класс `slideshow-active` не вешается
- Обычный синий экран перерыва работает как раньше
- Браузер без `showDirectoryPicker` (не Chrome) → `alert` + ранний выход

## Проверка

1. Открыть настройки → секция «Слайдшоу на перерыве» видна
2. Нажать кнопку выбора папки → диалог → папка выбрана, счётчик фото отображается
3. Включить чекбокс слайдшоу
4. Нажать ⏩ 1:05 → подождать 65 сек → перерыв начинается → слайдшоу запускается
5. Проверить: фото меняются, обратный отсчёт виден снизу слева
6. Дождаться конца перерыва → слайдшоу останавливается, возвращается обычный экран
7. Проверить кнопки ⏪ ⏩ — слайдшоу стартует/останавливается корректно
