// Checks that the public key cannot change finished games or files, and that signed uploads still work.
// Writes to the database use current values, so a failed check changes no data.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
  .filter(line => line.includes('=') && !line.trim().startsWith('#'))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const auth = key => ({ apikey: key, Authorization: `Bearer ${key}` });
const json = { 'Content-Type': 'application/json' };
let failed = false;
function check(name, ok, detail = '') { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); if (!ok) failed = true; }

const game = (await (await fetch(`${url}/rest/v1/sessions?status=eq.finished&select=id&limit=1`, { headers: auth(anon) })).json())[0];
if (!game) throw new Error('No finished game to check');
const participant = (await (await fetch(`${url}/rest/v1/session_players?session_id=eq.${game.id}&select=id,rebuys&limit=1`, { headers: auth(anon) })).json())[0];

async function patchRows(table, id, body) {
  const response = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers: { ...auth(anon), ...json, Prefer: 'return=representation' }, body: JSON.stringify(body) });
  return response.ok ? (await response.json()).length : 0;
}
check('finished game cannot be updated', await patchRows('sessions', game.id, { status: 'finished' }) === 0);
check('finished game participant cannot be updated', await patchRows('session_players', participant.id, { rebuys: participant.rebuys }) === 0);

const merge = await fetch(`${url}/rest/v1/rpc/merge_tables`, { method: 'POST', headers: { ...auth(anon), ...json }, body: JSON.stringify({ p_session_id: game.id }) });
check('finished game cannot be merged', !merge.ok, String(merge.status));

for (const bucket of ['slideshow', 'avatars']) {
  const path = `verify-lockdown/${randomUUID()}.txt`;
  const upload = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { method: 'POST', headers: { ...auth(anon), 'Content-Type': 'text/plain' }, body: 'lockdown check' });
  check(`public key cannot upload to ${bucket}`, !upload.ok, String(upload.status));
  if (upload.ok) await fetch(`${url}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { ...auth(service), ...json }, body: JSON.stringify({ prefixes: [path] }) });
}

const signedPath = `verify-lockdown/${randomUUID()}.jpg`;
const sign = await (await fetch(`${url}/storage/v1/object/upload/sign/slideshow/${signedPath}`, { method: 'POST', headers: { ...auth(service), ...json }, body: '{}' })).json();
const token = new URL(sign.url, url).searchParams.get('token');
const form = new FormData();
form.append('', new Blob(['lockdown check'], { type: 'image/jpeg' }), 'check.jpg');
const signed = await fetch(`${url}/storage/v1/object/upload/sign/slideshow/${signedPath}?token=${token}`, { method: 'PUT', headers: { ...auth(anon), 'x-upsert': 'false' }, body: form });
check('signed upload still works', signed.ok, String(signed.status));
const uploaded = await fetch(`${url}/storage/v1/object/public/slideshow/${signedPath}`);
check('uploaded file is public', uploaded.ok, String(uploaded.status));
const publicRemove = await fetch(`${url}/storage/v1/object/slideshow`, { method: 'DELETE', headers: { ...auth(anon), ...json }, body: JSON.stringify({ prefixes: [signedPath] }) });
const stillThere = await fetch(`${url}/storage/v1/object/public/slideshow/${signedPath}`);
check('public key cannot delete files', stillThere.ok, `delete ${publicRemove.status}, file ${stillThere.status}`);
const remove = await fetch(`${url}/storage/v1/object/slideshow`, { method: 'DELETE', headers: { ...auth(service), ...json }, body: JSON.stringify({ prefixes: [signedPath] }) });
check('server can remove file', remove.ok, String(remove.status));

const publicPage = await fetch(`${url}/rest/v1/game_photos?select=id&limit=1`, { headers: auth(anon) });
check('public reading still works', publicPage.ok, String(publicPage.status));
if (failed) process.exitCode = 1;
