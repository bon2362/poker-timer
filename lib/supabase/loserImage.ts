// lib/supabase/loserImage.ts
import { getClient } from '@/supabase/client';

const BUCKET = 'avatars';

function path(playerId: string) {
  return `loser-${playerId}.jpg`;
}

/** Возвращает публичный URL изображения проигравшего для игрока или null */
export async function getLoserImageUrl(playerId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const filePath = path(playerId);
  const { data } = await client.storage.from(BUCKET).list('', { search: filePath });
  if (!data?.find(f => f.name === filePath)) return null;
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(filePath, {
    transform: { width: 1920, quality: 80 },
  });
  return urlData.publicUrl;
}

/** Возвращает URL миниатюры проигравшего через Supabase Image Transformations */
export async function getLoserThumbUrl(playerId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const filePath = path(playerId);
  const { data } = await client.storage.from(BUCKET).list('', { search: filePath });
  if (!data?.find(f => f.name === filePath)) return null;
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(filePath, {
    transform: { width: 200, height: 200, resize: 'cover' },
  });
  return urlData.publicUrl;
}

/** Загружает изображение проигравшего, возвращает URL оригинала или null */
export async function uploadLoserImage(playerId: string, file: File): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const result = await client.storage.from(BUCKET).upload(path(playerId), file, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });

  if (result.error) { console.error('uploadLoserImage:', result.error); return null; }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path(playerId));
  return data.publicUrl;
}

/** Удаляет изображение проигравшего */
export async function deleteLoserImage(playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path(playerId)]);
}
