// lib/supabase/winnerImage.ts
import { deleteSpecialImage, getSpecialImageUrl, getSpecialThumbUrl, uploadSpecialImage } from './imageVariants';

/** Возвращает публичный URL изображения победителя для игрока или null */
export async function getWinnerImageUrl(playerId: string): Promise<string | null> {
  return getSpecialImageUrl('winner', playerId);
}

/** Возвращает URL миниатюры победителя */
export async function getWinnerThumbUrl(playerId: string): Promise<string | null> {
  return getSpecialThumbUrl('winner', playerId);
}

/** Загружает изображение победителя, возвращает URL оригинала или null */
export async function uploadWinnerImage(playerId: string, file: File): Promise<string | null> {
  return uploadSpecialImage('winner', playerId, file);
}

/** Удаляет изображение победителя */
export async function deleteWinnerImage(playerId: string): Promise<void> {
  await deleteSpecialImage('winner', playerId);
}
