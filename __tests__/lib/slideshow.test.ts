import { getClient } from '@/supabase/client';
import { listSlideshowItems, listSlideshowPhotos } from '@/lib/supabase/slideshow';

jest.mock('@/supabase/client', () => ({ getClient: jest.fn() }));

type PhotoRow = {
  id: string;
  path: string;
  taken_at: string | null;
  sessions: { created_at: string } | null;
};

function usePhotos(rows: PhotoRow[], failedPage?: number) {
  const range = jest.fn(async (from: number, to: number) => {
    if (failedPage === from) return { data: null, error: { message: 'Unavailable' } };
    return { data: rows.slice(from, to + 1), error: null };
  });
  const order = jest.fn(() => ({ range }));
  const select = jest.fn(() => ({ order }));
  const from = jest.fn((table: string) => {
    if (table !== 'game_photos') throw new Error(`Unexpected table: ${table}`);
    return { select };
  });
  (getClient as jest.Mock).mockReturnValue({
    from,
    storage: { from: (bucket: string) => {
      if (bucket !== 'slideshow') throw new Error(`Unexpected bucket: ${bucket}`);
      return { getPublicUrl: (path: string) => ({ data: { publicUrl: `https://photos.example/${path}` } }) };
    } },
  });
  return { select, order };
}

beforeEach(() => jest.resetAllMocks());

test('reads every photo beyond the 1000-row limit in a stable order', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i), path: `games/photo-${i}.jpg`, taken_at: null, sessions: null,
  }));
  const { select, order } = usePhotos(rows);

  const items = await listSlideshowItems();

  expect(items).toHaveLength(1001);
  expect(items[0]).toEqual({ url: 'https://photos.example/games/photo-0.jpg', date: null });
  expect(items[1000]).toEqual({ url: 'https://photos.example/games/photo-1000.jpg', date: null });
  expect(select).toHaveBeenCalledWith(expect.stringContaining('sessions(created_at)'));
  expect(order).toHaveBeenCalledWith('id', { ascending: true });
});

test.each([
  [{ created_at: '2026-10-31T23:30:00Z' }, '2026-05-09T12:00:00Z', '01.11.2026'],
  [{ created_at: '2026-05-09T22:30:00Z' }, null, '10.05.2026'],
  [null, '2026-05-09T22:30:00Z', '10.05.2026'],
  [null, null, null],
] as const)('chooses the game date in Belgrade or the available taken_at date (%j, %s)', async (sessions, taken_at, date) => {
  usePhotos([{ id: 'photo', path: '31-10-2020.jpg', sessions, taken_at }]);
  await expect(listSlideshowItems()).resolves.toEqual([
    { url: 'https://photos.example/31-10-2020.jpg', date },
  ]);
});

test('keeps the URL-only export for settings and the final slideshow', async () => {
  usePhotos([{ id: 'photo', path: 'game/photo.webp', taken_at: null, sessions: null }]);
  await expect(listSlideshowPhotos()).resolves.toEqual(['https://photos.example/game/photo.webp']);
});

test('returns no partial collection when a later page fails', async () => {
  usePhotos(Array.from({ length: 1001 }, (_, i) => ({
    id: String(i), path: `${i}.jpg`, taken_at: null, sessions: null,
  })), 1000);
  await expect(listSlideshowItems()).resolves.toEqual([]);
});

test('returns an empty collection without a Supabase client', async () => {
  (getClient as jest.Mock).mockReturnValue(null);
  await expect(listSlideshowItems()).resolves.toEqual([]);
});
