// lib/supabase/slideshow.ts
import { getClient } from '@/supabase/client';
import { gameDateInBelgrade } from '@/lib/games/slug';

const BUCKET = 'slideshow';
const PAGE_SIZE = 1000;

export type SlideshowItem = { url: string; date: string | null };

type PhotoRow = {
  path: string;
  taken_at: string | null;
  sessions: { created_at: string } | null;
};

/** Читает все записи фото, используя дату игры или дату съёмки. */
export async function listSlideshowItems(): Promise<SlideshowItem[]> {
  const client = getClient();
  if (!client) return [];
  const items: SlideshowItem[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from('game_photos')
      .select('id,path,taken_at,sessions(created_at)')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) return [];
    for (const photo of data as unknown as PhotoRow[]) {
      const iso = photo.sessions?.created_at ?? photo.taken_at;
      let date = null;
      if (iso) {
        const { day, month, year } = gameDateInBelgrade(iso);
        date = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
      }
      items.push({ url: client.storage.from(BUCKET).getPublicUrl(photo.path).data.publicUrl, date });
    }
    if (data.length < PAGE_SIZE) return items;
  }
}

/** Совместимый список адресов для настроек и финального слайд-шоу. */
export async function listSlideshowPhotos(): Promise<string[]> {
  return (await listSlideshowItems()).map(item => item.url);
}

/** Загружает один файл в бакет, возвращает true при успехе */
export async function uploadSlideshowPhoto(file: File): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  // Сохраняем оригинальное имя файла (с префиксом для уникальности)
  const path = `${Date.now()}-${file.name}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file);
  if (error) console.error('[slideshow] upload error:', error.message, error);
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
