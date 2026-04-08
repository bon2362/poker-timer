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

/** Загружает изображение победителя для игрока, возвращает URL или null */
export async function uploadWinnerImage(playerId: string, file: File): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const filePath = path(playerId);
  const { error } = await client.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type || 'image/jpeg', upsert: true });
  if (error) { console.error('uploadWinnerImage:', error); return null; }
  const { data } = client.storage.from(BUCKET).getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Удаляет изображение победителя для игрока */
export async function deleteWinnerImage(playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path(playerId)]);
}
