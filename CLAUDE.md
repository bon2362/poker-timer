# Poker Timer — инструкции для Claude

## Стек и ссылки

- **Репозиторий:** https://github.com/bon2362/poker-timer
- **Прод (Vercel):** https://poker-timer-a78easjy5-bon2362-5067s-projects.vercel.app
- **Бэклог (GitHub Projects):** https://github.com/users/bon2362/projects/2
- **Основной файл:** `poker-timer.html` (single-file, без зависимостей — весь JS/CSS/HTML внутри)

## Архитектура

Single-file vanilla HTML/CSS/JS. Никаких фреймворков, никаких зависимостей.
Настройки хранятся в `localStorage` (ключ `pokerTimerConfig`).
Base64-MP3 голосовых фраз встроены прямо в файл.

## Деплой

Автоматический: каждый `git push` в `main` → Vercel деплоит сам. CLI не нужен.

## Бэклог

Issues в репозитории + GitHub Projects. Добавлять задачу:
```bash
gh issue create --repo bon2362/poker-timer --title "..." --body "..."
gh project item-add 2 --owner bon2362 --url <issue_url>
```

Закрыть задачу после выполнения:
```bash
gh issue close <N> --repo bon2362/poker-timer
```

## Версионирование

Текущая версия: **3.19**

Версия отображается в шапке экрана настроек (`poker-timer.html`):
```html
<div style="font-size:11px;color:#444;margin-top:2px;">v3.19</div>
```

**Правила:**
- При каждом изменении кода автоматически увеличивать минорную версию: 3.19 → 3.20 → 3.21 и т.д.
- Мажорную версию поднимать только по явной просьбе пользователя: 3.x → 4.0
- После изменения версии обновлять её в этом файле (строка «Текущая версия»)
