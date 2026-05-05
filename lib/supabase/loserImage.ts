// lib/supabase/loserImage.ts
import { deleteSpecialImage, getSpecialImageUrl, getSpecialThumbUrl, uploadSpecialImage } from './imageVariants';

/** Возвращает публичный URL изображения проигравшего для игрока или null */
export async function getLoserImageUrl(playerId: string): Promise<string | null> {
  return getSpecialImageUrl('loser', playerId);
}

/** Возвращает URL миниатюры проигравшего */
export async function getLoserThumbUrl(playerId: string): Promise<string | null> {
  return getSpecialThumbUrl('loser', playerId);
}

/** Загружает изображение проигравшего, возвращает URL оригинала или null */
export async function uploadLoserImage(playerId: string, file: File): Promise<string | null> {
  return uploadSpecialImage('loser', playerId, file);
}

/** Удаляет изображение проигравшего */
export async function deleteLoserImage(playerId: string): Promise<void> {
  await deleteSpecialImage('loser', playerId);
}
