// lib/supabase/slideshow.ts
import { getClient } from '@/supabase/client';

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
        date = new Intl.DateTimeFormat('ru-RU', {
          timeZone: 'Europe/Belgrade', day: 'numeric', month: 'long', year: 'numeric',
        }).formatToParts(new Date(iso))
          .filter(part => ['day', 'month', 'year'].includes(part.type))
          .map(part => part.value).join(' ');
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
