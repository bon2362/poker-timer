# Poker Timer — инструкции для Claude

## Стек и ссылки

- **Репозиторий:** https://github.com/bon2362/poker-timer
- **Прод (Vercel):** https://poker-timer-black.vercel.app
- **Бэклог (GitHub Projects):** https://github.com/users/bon2362/projects/2

## Архитектура

Next.js 15 App Router + TypeScript + Tailwind CSS + Supabase Realtime.
Настройки хранятся в `localStorage` (ключ `pokerTimerConfig`).
Компоненты в `components/`, логика в `lib/` и `reducer/`, типы в `types/`.

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

Текущая версия: **4.23**

Версия отображается в шапке экрана настроек (`components/SettingsScreen.tsx`).

**Правила:**
- При каждом изменении кода автоматически увеличивать минорную версию: 4.0 → 4.1 → 4.2 и т.д.
- Мажорную версию поднимать только по явной просьбе пользователя: 4.x → 5.0
- После изменения версии обновлять её в этом файле (строка «Текущая версия»)
- При добавлении новой фичи добавлять запись в массив `CHANGELOG` в начале `components/SettingsScreen.tsx` — новая версия вставляется первой в массиве
