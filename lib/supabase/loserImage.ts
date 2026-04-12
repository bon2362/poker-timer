// lib/supabase/loserImage.ts
import { getClient } from '@/supabase/client';
import { generateThumbnail } from '@/lib/image/generateThumbnail';

const BUCKET = 'avatars';

function path(playerId: string) {
  return `loser-${playerId}.jpg`;
}

function thumbPath(playerId: string) {
  return `loser-${playerId}-thumb.jpg`;
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

/** Тихо генерирует и загружает миниатюру из существующего полного изображения */
async function lazyGenerateLoserThumb(playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(path(playerId));
  try {
    const response = await fetch(urlData.publicUrl);
    if (!response.ok) return;
    const blob = await response.blob();
    const thumb = await generateThumbnail(blob);
    await client.storage.from(BUCKET).upload(thumbPath(playerId), thumb, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  } catch { /* silent */ }
}

/** Возвращает URL миниатюры проигравшего (fallback + ленивая генерация для старых изображений) */
export async function getLoserThumbUrl(playerId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const tp = thumbPath(playerId);
  const { data } = await client.storage.from(BUCKET).list('', { search: tp });
  if (data?.find(f => f.name === tp)) {
    const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(tp);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  }
  // Миниатюры нет — запускаем генерацию в фоне, пока возвращаем оригинал
  lazyGenerateLoserThumb(playerId);
  return getLoserImageUrl(playerId);
}

/** Загружает изображение проигравшего + миниатюру, возвращает URL оригинала или null */
export async function uploadLoserImage(playerId: string, file: File): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const thumbBlob = await generateThumbnail(file);

  const [origResult, thumbResult] = await Promise.all([
    client.storage.from(BUCKET).upload(path(playerId), file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    }),
    client.storage.from(BUCKET).upload(thumbPath(playerId), thumbBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
  ]);

  if (origResult.error) { console.error('uploadLoserImage:', origResult.error); return null; }
  if (thumbResult.error) { console.error('uploadLoserThumb:', thumbResult.error); }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path(playerId));
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Удаляет изображение проигравшего и его миниатюру */
export async function deleteLoserImage(playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path(playerId), thumbPath(playerId)]);
}
