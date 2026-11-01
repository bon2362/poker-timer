import { getClient } from '@/supabase/client';
import { resizeContain, resizeCover } from '@/lib/imageResize';
import { uploadToSignedPath } from './signedUpload';

type SpecialImageKind = 'winner' | 'loser';
const BUCKET = 'avatars';

export async function getCurrentPlayerImage(playerId: string, kind: SpecialImageKind): Promise<{ id: string; url: string; thumbUrl: string } | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client.from('player_images').select('id,path,thumb_path').eq('player_id', playerId).eq('kind', kind).eq('is_current', true).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    url: client.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl,
    thumbUrl: client.storage.from(BUCKET).getPublicUrl(data.thumb_path ?? data.path).data.publicUrl,
  };
}

export async function getSpecialImageUrl(kind: SpecialImageKind, playerId: string): Promise<string | null> {
  return (await getCurrentPlayerImage(playerId, kind))?.url ?? null;
}

export async function getSpecialThumbUrl(kind: SpecialImageKind, playerId: string): Promise<string | null> {
  return (await getCurrentPlayerImage(playerId, kind))?.thumbUrl ?? null;
}

export async function uploadSpecialImage(kind: SpecialImageKind, playerId: string, file: File): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const [full, thumb] = await Promise.all([
    resizeContain(file, 1920, 1920, 0.82),
    resizeCover(file, 200, 0.76),
  ]);
  const signed = await fetch('/api/admin/uploads/sign', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bucket: BUCKET, playerId, kind, files: [{ name: 'full.jpg' }, { name: 'thumb.jpg' }] }),
  });
  if (!signed.ok) return null;
  const { uploads } = await signed.json();
  if (!Array.isArray(uploads) || uploads.length !== 2) return null;
  const uploaded = await Promise.all([
    uploadToSignedPath(BUCKET, uploads[0].path, uploads[0].token, full),
    uploadToSignedPath(BUCKET, uploads[1].path, uploads[1].token, thumb),
  ]);
  if (uploaded.some(success => !success)) return null;
  const saved = await fetch('/api/admin/player-images', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId, kind, path: uploads[0].path, thumbPath: uploads[1].path }),
  });
  return saved.ok ? client.storage.from(BUCKET).getPublicUrl(uploads[0].path).data.publicUrl : null;
}

export async function deleteSpecialImage(kind: SpecialImageKind, playerId: string): Promise<void> {
  const response = await fetch('/api/admin/player-images', {
    method: 'DELETE', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId, kind }),
  });
  if (!response.ok) throw new Error('Could not delete image');
}
