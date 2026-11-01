// One-off: adds a preview and the original size to photos created before previews existed.
// Original files are never changed. Safe to run again: rows that already have both values are skipped.
// Usage: node scripts/backfill-photo-variants.mjs [--apply]   (without --apply nothing is written)
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
  .filter(line => line.includes('=') && !line.trim().startsWith('#'))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const auth = { apikey: key, Authorization: `Bearer ${key}` };
const apply = process.argv.includes('--apply');
const BUCKET = 'slideshow';

const response = await fetch(`${url}/rest/v1/game_photos?select=id,path,thumb_path,width,height&or=(thumb_path.is.null,width.is.null)&limit=2000`, { headers: auth });
if (!response.ok) throw new Error(`Could not read photos: ${response.status}`);
const rows = await response.json();
console.log(`photos to process: ${rows.length}, mode: ${apply ? 'apply' : 'dry run'}`);

let done = 0; let failed = 0; let thumbBytes = 0; let fullBytes = 0;
async function processRow(row) {
  const source = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${row.path.split('/').map(encodeURIComponent).join('/')}`);
  if (!source.ok) throw new Error(`download ${source.status}`);
  const buffer = Buffer.from(await source.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  const thumb = await sharp(buffer).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer();
  fullBytes += buffer.length; thumbBytes += thumb.length;
  if (!apply) return;
  const thumbPath = row.thumb_path ?? `uploads/${randomUUID()}.jpg`;
  if (!row.thumb_path) {
    const upload = await fetch(`${url}/storage/v1/object/${BUCKET}/${thumbPath}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: thumb });
    if (!upload.ok) throw new Error(`upload ${upload.status}`);
  }
  const update = await fetch(`${url}/rest/v1/game_photos?id=eq.${row.id}`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ thumb_path: thumbPath, width, height }) });
  if (!update.ok) {
    if (!row.thumb_path) await fetch(`${url}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [thumbPath] }) });
    throw new Error(`update ${update.status}`);
  }
}

let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < rows.length) {
    const row = rows[cursor++];
    try { await processRow(row); done++; }
    catch (error) { failed++; console.error(`FAIL ${row.id}: ${error.message}`); }
  }
}));
const mb = bytes => (bytes / 1048576).toFixed(1);
console.log(`done: ${done}, failed: ${failed}, originals: ${mb(fullBytes)} MB, previews: ${mb(thumbBytes)} MB`);
if (failed) process.exitCode = 1;
