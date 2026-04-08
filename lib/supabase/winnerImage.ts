// lib/supabase/winnerImage.ts
import { getClient } from '@/supabase/client';

const BUCKET = 'avatars';
const PATH = 'winner.jpg';

/** Возвращает публичный URL изображения победителя или null */
export async function getWinnerImageUrl(): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.storage.from(BUCKET).list('', { search: 'winner.jpg' });
  if (!data?.length) return null;
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(PATH);
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

/** Загружает изображение победителя, возвращает URL или null */
export async function uploadWinnerImage(file: File): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const { error } = await client.storage
    .from(BUCKET)
    .upload(PATH, file, { contentType: file.type || 'image/jpeg', upsert: true });
  if (error) { console.error('uploadWinnerImage:', error); return null; }
  const { data } = client.storage.from(BUCKET).getPublicUrl(PATH);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Удаляет изображение победителя */
export async function deleteWinnerImage(): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([PATH]);
}
