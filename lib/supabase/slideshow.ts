// lib/supabase/slideshow.ts
import { getClient } from '@/supabase/client';

const BUCKET = 'slideshow';

/** Возвращает публичные URL всех фото из бакета */
export async function listSlideshowPhotos(): Promise<string[]> {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.storage
    .from(BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error || !data) return [];
  return data
    .filter(f => /\.(jpg|jpeg|png|webp|gif|avif|bmp)$/i.test(f.name))
    .map(f => client.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl);
}

/** Загружает один файл в бакет, возвращает true при успехе */
export async function uploadSlideshowPhoto(file: File): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  // Сохраняем оригинальное имя файла (с префиксом для уникальности)
  const path = `${Date.now()}-${file.name}`;
  console.log('[slideshow] uploading as path:', path);
  const { data, error } = await client.storage.from(BUCKET).upload(path, file);
  if (error) console.error('[slideshow] upload error:', error.message, error);
  console.log('[slideshow] upload result path:', data?.path);
  return !error;
}

/** Удаляет все файлы из бакета */
export async function deleteAllSlideshowPhotos(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { data } = await client.storage.from(BUCKET).list('');
  if (!data?.length) return;
  await client.storage.from(BUCKET).remove(data.map(f => f.name));
}
