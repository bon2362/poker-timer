/**
 * org-usage — Supabase Edge Function
 *
 * Возвращает метрики проекта: размер storage, БД и трафик за сегодня.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 * - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — авто-инжектируются
 * - ORG_PAT — Personal Access Token (supabase.com/dashboard/account/tokens),
 *   нужен для DB size и аналитики. Хранить как Supabase Secret:
 *     supabase secrets set ORG_PAT=sbp_xxxx
 *
 * ── Deploy ───────────────────────────────────────────────────────────────────
 *   supabase functions deploy org-usage --no-verify-jwt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PROJECT_REF = 'dbayngkhribcllxdoozo';

async function mgmtFetch(pat: string, path: string, init?: RequestInit) {
  return fetch(`https://api.supabase.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

Deno.serve(async () => {
  const pat = Deno.env.get('ORG_PAT') ?? null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // ── 1. Storage size via service role ──────────────────────────────────────
  const storagePromise = supabase
    .schema('storage')
    .from('objects')
    .select('metadata->size')
    .then(({ data }) => {
      const bytes = (data ?? []).reduce(
        (sum, row) => sum + (Number((row as { size: unknown }).size) || 0),
        0
      );
      return { storage_size_bytes: bytes };
    });

  // ── 2. DB size via Management API ─────────────────────────────────────────
  const dbPromise = pat
    ? mgmtFetch(pat, `/v1/projects/${PROJECT_REF}/database/query/read-only`, {
        method: 'POST',
        body: JSON.stringify({ query: 'SELECT pg_database_size(current_database()) AS size' }),
      })
        .then((r) => r.json())
        .then((rows: unknown) => ({
          db_size_bytes: Number((rows as { size: unknown }[])?.[0]?.size ?? 0),
        }))
    : Promise.resolve({ db_size_bytes: null as number | null });

  // ── 3. Today's storage requests via Analytics API ─────────────────────────
  const logsSql = `
    SELECT
      (responseHeaders.cf_cache_status = 'HIT') AS cached,
      COUNT(*) AS requests
    FROM edge_logs
      CROSS JOIN UNNEST(metadata) AS metadata
      CROSS JOIN UNNEST(metadata.request) AS request
      CROSS JOIN UNNEST(metadata.response) AS response
      CROSS JOIN UNNEST(response.headers) AS responseHeaders
    WHERE
      (request.path LIKE '%/storage/v1/object/%'
       OR request.path LIKE '%/storage/v1/render/%')
      AND timestamp > TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), DAY)
    GROUP BY 1
  `.trim();

  const logsPromise = pat
    ? mgmtFetch(
        pat,
        `/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all` +
          `?iso_timestamp_start=${encodeURIComponent(todayIso)}` +
          `&sql=${encodeURIComponent(logsSql)}`
      )
        .then((r) => r.json())
        .then((body: unknown) => ({ rows: (body as { result?: unknown[] })?.result ?? [] }))
    : Promise.resolve({ rows: [] as unknown[] });

  const [storageRes, dbRes, logsRes] = await Promise.allSettled([
    storagePromise,
    dbPromise,
    logsPromise,
  ]);

  const storage = storageRes.status === 'fulfilled' ? storageRes.value : { storage_size_bytes: null };
  const db = dbRes.status === 'fulfilled' ? dbRes.value : { db_size_bytes: null };
  const logsRows = logsRes.status === 'fulfilled' ? logsRes.value.rows : [];

  type LogRow = { cached: boolean | string; requests: number | string };
  const cachedRow = (logsRows as LogRow[]).find((r) => r.cached === true || r.cached === 'true');
  const uncachedRow = (logsRows as LogRow[]).find((r) => r.cached === false || r.cached === 'false');

  return new Response(
    JSON.stringify({
      storage_size_bytes: storage.storage_size_bytes,
      db_size_bytes: db.db_size_bytes,
      today_cached_requests: Number(cachedRow?.requests ?? 0),
      today_uncached_requests: Number(uncachedRow?.requests ?? 0),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
