/**
 * org-usage — Supabase Edge Function
 *
 * Возвращает usage-метрики организации Supabase (egress, storage, realtime и т.д.)
 * через Supabase Management API, используя Personal Access Token,
 * хранящийся в Supabase Secrets — вне Vercel.
 *
 * ── Setup ────────────────────────────────────────────────────────────────────
 *
 * 1. Создай Personal Access Token (read-only):
 *      https://supabase.com/dashboard/account/tokens
 *      Срок: 90 дней (или меньше), scope: минимально необходимый
 *
 * 2. Сохрани токен как Supabase Secret:
 *      supabase secrets set ORG_PAT=sbp_xxxxxxxxxxxx
 *
 * 3. Задеплой функцию:
 *      supabase functions deploy org-usage --no-verify-jwt
 *
 * ── Notes ────────────────────────────────────────────────────────────────────
 * - --no-verify-jwt: функция вызывается с anon key из Next.js сервера,
 *   стандартная JWT-проверка Supabase для этого достаточна
 * - PAT нигде в Vercel не хранится
 */

const ORG_SLUG = 'nkaxdmzhrfetvgymjqyp';

const METRICS = [
  'CACHED_EGRESS',
  'EGRESS',
  'STORAGE_SIZE',
  'DATABASE_SIZE',
  'REALTIME_MESSAGE_COUNT',
  'REALTIME_PEAK_CONNECTIONS',
];

Deno.serve(async () => {
  const pat = Deno.env.get('ORG_PAT');
  if (!pat) {
    return new Response(
      JSON.stringify({ error: 'ORG_PAT secret not set' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const res = await fetch(
    `https://api.supabase.com/platform/organizations/${ORG_SLUG}/usage`,
    { headers: { Authorization: `Bearer ${pat}` } }
  );

  if (!res.ok) {
    const body = await res.text();
    return new Response(
      JSON.stringify({ error: `Management API ${res.status}: ${body}` }),
      { status: res.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const json = await res.json() as { usages?: { metric: string; [k: string]: unknown }[] };
  const usages = (json.usages ?? []).filter((u) => METRICS.includes(u.metric));

  return new Response(
    JSON.stringify({ usages }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
