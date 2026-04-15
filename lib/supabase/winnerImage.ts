// lib/supabase/winnerImage.ts
import { getClient } from '@/supabase/client';

const BUCKET = 'avatars';

function path(playerId: string) {
  return `winner-${playerId}.jpg`;
}

/** Возвращает публичный URL изображения победителя для игрока или null */
export async function getWinnerImageUrl(playerId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const filePath = path(playerId);
  const { data } = await client.storage.from(BUCKET).list('', { search: filePath });
  if (!data?.find(f => f.name === filePath)) return null;
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(filePath);
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

/** Возвращает URL миниатюры победителя через Supabase Image Transformations */
export async function getWinnerThumbUrl(playerId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const filePath = path(playerId);
  const { data } = await client.storage.from(BUCKET).list('', { search: filePath });
  if (!data?.find(f => f.name === filePath)) return null;
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(filePath, {
    transform: { width: 200, height: 200, resize: 'cover' },
  });
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

/** Загружает изображение победителя, возвращает URL оригинала или null */
export async function uploadWinnerImage(playerId: string, file: File): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const result = await client.storage.from(BUCKET).upload(path(playerId), file, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });

  if (result.error) { console.error('uploadWinnerImage:', result.error); return null; }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path(playerId));
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Удаляет изображение победителя */
export async function deleteWinnerImage(playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path(playerId)]);
}
