import { getClient } from '@/supabase/client';
import { listFinishedGames, getGameBySlug, getLeaderboard } from '@/lib/games/queries';

jest.mock('@/supabase/client', () => ({ getClient: jest.fn() }));
const player = { id: 'p1', name: 'Алекс', avatar_url: null, archived_at: '2026-10-01' };
const participant = { id: 'sp1', session_id: 'old', player_id: 'p1', rebuys: 1, has_addon: true, status: 'winner', finish_position: 1, payout: 3000, players: player };
function game(id: string, created_at: string, status = 'finished') {
  return { id, slug: id, created_at, status, buy_in: 1000, rebuy_cost: 1000, addon_cost: 1000,
    initial_stack: 10000, rebuy_chips: 10000, max_rebuys: 2, addon_chips: 10000, prize_spots: 1,
    prize_pcts: [100], finished_at: created_at, finished_at_approximate: false, blind_structure: null,
    session_players: [{ ...participant, session_id: id }], game_photos: [] };
}
let rows: ReturnType<typeof game>[];
beforeEach(() => {
  rows = [game('old', '2026-05-10T12:00:00Z'), game('new', '2026-10-31T12:00:00Z'), game('active', '2026-11-01T12:00:00Z', 'active')];
  (getClient as jest.Mock).mockReturnValue({
    from: () => {
      let filtered = [...rows];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filtered = filtered.filter(row => row[key as keyof typeof row] === value); return query; },
        order: () => { filtered.sort((a, b) => b.created_at.localeCompare(a.created_at)); return query; },
        range: async (from: number, to: number) => ({ data: filtered.slice(from, to + 1), error: null }),
      };
      return query;
    },
    storage: { from: (bucket: string) => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://images.example/${bucket}/${path}` } }) }) },
  });
});
test('publishes only finished games with winners, newest first', async () => {
  rows.push({ ...game('no-winner', '2026-11-02T12:00:00Z'), session_players: [] });
  expect((await listFinishedGames()).map(game => game.session.slug)).toEqual(['new', 'old']);
});
test('unknown or unfinished slug is not public', async () => {
  expect(await getGameBySlug('missing')).toBeNull();
  expect(await getGameBySlug('active')).toBeNull();
});
test('retains archived player names and counts their finished games', async () => {
  expect(await getLeaderboard()).toEqual([{ playerId: 'p1', name: 'Алекс', avatarUrl: null, games: 2, wins: 2, prizes: 2, totalWon: 6000, net: 0 }]);
});
test('reads every page of finished games', async () => {
  rows = Array.from({ length: 1001 }, (_, i) => game(`game-${i}`, '2026-10-31T12:00:00Z'));
  expect(await listFinishedGames()).toHaveLength(1001);
});
test('returns an empty catalogue without database configuration', async () => {
  (getClient as jest.Mock).mockReturnValue(null);
  expect(await listFinishedGames()).toEqual([]);
});
test('timer images follow finish places, winner first', async () => {
  const row = game('ordered', '2026-10-31T12:00:00Z');
  const entry = (id: string, place: number, kind: 'winner' | 'loser') => ({ ...participant, id, session_id: row.id, player_id: id, status: kind === 'winner' ? 'winner' : 'eliminated', finish_position: place, players: { ...player, id, name: id }, [`${kind}_image`]: { id: `image-${place}`, path: `${id}.jpg`, thumb_path: null } });
  rows = [{ ...row, session_players: [entry('c', 3, 'loser'), entry('a', 1, 'winner'), entry('j', 10, 'loser'), entry('b', 2, 'loser')] } as unknown as ReturnType<typeof game>];
  const details = await getGameBySlug('ordered');
  expect(details?.images.map(image => image.finishPosition)).toEqual([1, 2, 3, 10]);
});
test('uses saved images and photo thumbnails, with full-photo fallback and chronological order', async () => {
  const row = game('photo-game', '2026-10-31T12:00:00Z');
  const fixture = { ...row, session_players: [{ ...participant, session_id: row.id, winner_image: { id: 'historic-image', path: 'special/winner/old.jpg', thumb_path: 'special/winner/old-thumb.jpg' } }], game_photos: [
    { id: 'later', session_id: row.id, path: 'later.jpg', thumb_path: null, width: 800, height: 600, taken_at: '2026-10-31T20:00:00Z', created_at: '2026-11-01T00:00:00Z' },
    { id: 'earlier', session_id: row.id, path: 'earlier.jpg', thumb_path: 'earlier-thumb.jpg', width: 1200, height: 900, taken_at: '2026-10-31T18:00:00Z', created_at: '2026-11-01T00:00:00Z' },
  ] };
  rows = [fixture as unknown as ReturnType<typeof game>];
  const details = await getGameBySlug('photo-game');
  expect(details?.images).toEqual([{ id: 'historic-image', playerId: 'p1', name: 'Алекс', kind: 'winner', finishPosition: 1, url: 'https://images.example/avatars/special/winner/old.jpg', thumbUrl: 'https://images.example/avatars/special/winner/old-thumb.jpg' }]);
  expect(details?.photos.map(photo => [photo.id, photo.thumbUrl, photo.width, photo.height])).toEqual([
    ['earlier', 'https://images.example/slideshow/earlier-thumb.jpg', 1200, 900],
    ['later', 'https://images.example/slideshow/later.jpg', 800, 600],
  ]);
});
