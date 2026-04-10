# Follow-up review findings — 2026-04-10

Повторная проверка проекта `/Users/ekoshkin/poker` после внесенных изменений.

## Краткий итог

Исходный finding про Jest и вложенный `.worktrees` закрыт: `jest.config.ts` теперь игнорирует `.worktrees`, а `npx jest --listTests --runInBand` показывает только тесты из корня проекта.

Также выглядят исправленными предыдущие P1 по Supabase fallback, remote session creation, mobile max rebuys и stale timer reducer tests.

Новые риски в основном относятся к Supabase migrations/Edge Function security и локальным temp-файлам Supabase CLI.

## Findings

### Finding 1: [P1] Anon can read/delete push tokens

Файл: `/Users/ekoshkin/poker/supabase/push_tokens_migration.sql:25`

Политика называется `allow_anon_upsert`, но `FOR ALL TO anon USING (true) WITH CHECK (true)` дает публичным клиентам не только upsert, но и `SELECT`, `UPDATE`, `DELETE` для всех Live Activity push tokens.

Рекомендация: оставить таблицу приватной и открыть только `upsert_push_token` RPC, либо заменить broad `FOR ALL` на узкую политику insert/update без public read/delete.

### Finding 2: [P1] Push function trusts public anon requests

Файл: `/Users/ekoshkin/poker/supabase/functions/push-live-activity/index.ts:57`

Edge Function принимает любой `POST` payload, а в setup-инструкции используется публичный anon key. При этом функция читает push tokens через service role и отправляет APNs pushes. В результате любой, у кого есть frontend anon key, потенциально может инициировать forged Live Activity updates.

Рекомендация: добавить проверку webhook secret или service-only auth, валидировать источник webhook payload и отказывать запросам без доверенного секрета.

### Finding 3: [P2] Legacy timer_commands fallback is disabled by RLS

Файл: `/Users/ekoshkin/poker/supabase/rpc_commands_migration.sql:137`

Миграция удаляет broad policy для `timer_commands` и оставляет anon только `INSERT`, но web fallback все еще подписывается на `timer_commands` и удаляет обработанные строки. Без `SELECT`/`DELETE` этот fallback, вероятно, перестанет получать команды или чистить их после обработки.

Рекомендация: либо удалить legacy fallback из web-кода, если RPC стал единственным путем управления, либо добавить ограниченную policy/роль для web-клиента, которая явно покрывает subscribe/read/delete обработанных команд.

### Finding 4: [P2] Supabase temp files are still unignored

Файл: `/Users/ekoshkin/poker/.gitignore:33`

`git status` показывает `supabase/.temp/` как untracked. Эти файлы содержат локальное состояние Supabase CLI, включая project ref и pooler URL metadata.

Рекомендация: добавить `supabase/.temp/` в `.gitignore` до staging/commit.

## Проверки

- `npx jest --listTests --runInBand` — показывает только 4 тестовых файла из корня проекта, без `.worktrees`.
- `npm test -- --runInBand --cacheDirectory /tmp/jest-cache-poker` — проходит: 45 passed.
- `npx tsc --noEmit --pretty false --incremental false` — проходит.
- `npm run build` — проходит после перезапуска с разрешением на запись `.next/trace`.

## Приоритетный план

1. Закрыть public access к `push_tokens`: убрать broad `FOR ALL TO anon`.
2. Защитить `push-live-activity` webhook secret/service-only проверкой.
3. Решить судьбу legacy `timer_commands`: удалить fallback или согласовать RLS с фактическим использованием.
4. Добавить `supabase/.temp/` в `.gitignore`.

