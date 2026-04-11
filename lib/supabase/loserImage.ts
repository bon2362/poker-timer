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
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(filePath);
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

/** Загружает изображение проигравшего для игрока, возвращает URL или null */
export async function uploadLoserImage(playerId: string, file: File): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const filePath = path(playerId);
  const { error } = await client.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type || 'image/jpeg', upsert: true });
  if (error) { console.error('uploadLoserImage:', error); return null; }
  const { data } = client.storage.from(BUCKET).getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Удаляет изображение проигравшего для игрока */
export async function deleteLoserImage(playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path(playerId)]);
}
