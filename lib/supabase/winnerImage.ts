// lib/supabase/winnerImage.ts
import { getClient } from '@/supabase/client';
import { generateThumbnail } from '@/lib/image/generateThumbnail';

const BUCKET = 'avatars';

function path(playerId: string) {
  return `winner-${playerId}.jpg`;
}

function thumbPath(playerId: string) {
  return `winner-${playerId}-thumb.jpg`;
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

/** Возвращает URL миниатюры победителя (fallback на полный размер для старых изображений) */
export async function getWinnerThumbUrl(playerId: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const tp = thumbPath(playerId);
  const { data } = await client.storage.from(BUCKET).list('', { search: tp });
  if (data?.find(f => f.name === tp)) {
    const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(tp);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  }
  return getWinnerImageUrl(playerId);
}

/** Загружает изображение победителя + миниатюру, возвращает URL оригинала или null */
export async function uploadWinnerImage(playerId: string, file: File): Promise<string | null> {
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

  if (origResult.error) { console.error('uploadWinnerImage:', origResult.error); return null; }
  if (thumbResult.error) { console.error('uploadWinnerThumb:', thumbResult.error); }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path(playerId));
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Удаляет изображение победителя и его миниатюру */
export async function deleteWinnerImage(playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path(playerId), thumbPath(playerId)]);
}
