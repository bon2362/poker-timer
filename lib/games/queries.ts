import { getClient } from '@/supabase/client';
import { toSession, toSessionPlayer } from '@/lib/supabase/sessions';
import { buildLeaderboard, calcPlayerCost, type LeaderboardRow } from '@/lib/games/results';
import type { Session, SessionPlayer } from '@/types/game';

export type PublicGamePlayer = SessionPlayer & { name: string; avatarUrl: string | null };
export type GamePhoto = { id: string; sessionId: string | null; path: string; thumbPath: string | null; url: string; thumbUrl: string; width: number | null; height: number | null; takenAt: string | null; createdAt: string };
export type GameImage = { id: string; playerId: string; name: string; kind: 'winner' | 'loser'; finishPosition: number | null; url: string; thumbUrl: string };
export type GameSummary = { session: Session; players: PublicGamePlayer[]; winner: PublicGamePlayer; bank: number; photos: GamePhoto[] };
export type GameDetails = GameSummary & { images: GameImage[] };
export type PublicLeaderboardRow = LeaderboardRow & { name: string; avatarUrl: string | null };

type Row = Record<string, unknown>;
const PAGE_SIZE = 1000;
const SELECT = '*,session_players(*,players(id,name,avatar_url),loser_image:player_images!session_players_loser_image_id_fkey(id,path,thumb_path),winner_image:player_images!session_players_winner_image_id_fkey(id,path,thumb_path)),game_photos(*)';

async function readGames(slug?: string): Promise<GameDetails[]> {
  const client = getClient();
  if (!client) return [];
  const url = (bucket: string, path: string) => client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const games: GameDetails[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from('sessions').select(SELECT).eq('status', 'finished');
    if (slug !== undefined) query = query.eq('slug', slug);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error('Не удалось загрузить историю игр. Попробуйте ещё раз.');
    for (const row of (data ?? []) as Row[]) {
      const session = toSession(row);
      if (!session.slug || session.status !== 'finished') continue;
      const participants = (row.session_players ?? []) as Row[];
      const players = participants.map(participant => {
        const person = participant.players as Row;
        return { ...toSessionPlayer(participant), name: person.name as string, avatarUrl: (person.avatar_url as string | null) ?? null };
      }).sort((a, b) => (a.finishPosition ?? Infinity) - (b.finishPosition ?? Infinity));
      const winner = players.find(player => player.status === 'winner' && player.finishPosition === 1);
      if (!winner) continue;
      const photos = ((row.game_photos ?? []) as Row[]).map(photo => ({
        id: photo.id as string, sessionId: (photo.session_id as string | null) ?? null, path: photo.path as string,
        thumbPath: (photo.thumb_path as string | null) ?? null, url: url('slideshow', photo.path as string),
        thumbUrl: url('slideshow', (photo.thumb_path || photo.path) as string),
        width: (photo.width as number | null) ?? null, height: (photo.height as number | null) ?? null,
        takenAt: (photo.taken_at as string | null) ?? null, createdAt: photo.created_at as string,
      })).sort((a, b) => (a.takenAt ?? a.createdAt).localeCompare(b.takenAt ?? b.createdAt) || a.id.localeCompare(b.id));
      const images: GameImage[] = [];
      for (const participant of participants) {
        const player = players.find(item => item.id === participant.id)!;
        for (const kind of ['winner', 'loser'] as const) {
          const image = participant[`${kind}_image`] as Row | null;
          if (!image) continue;
          images.push({ id: image.id as string, playerId: player.playerId, name: player.name, finishPosition: player.finishPosition, kind,
            url: url('avatars', image.path as string), thumbUrl: url('avatars', (image.thumb_path || image.path) as string) });
        }
      }
      images.sort((a, b) => (a.finishPosition ?? Infinity) - (b.finishPosition ?? Infinity));
      games.push({ session, players, winner, photos, images, bank: players.reduce((sum, player) => sum + calcPlayerCost(session, player), 0) });
    }
    if (!data || data.length < PAGE_SIZE) return games;
  }
}

/** Uses only the public Supabase client; archived players remain included. */
export async function listFinishedGames(): Promise<GameSummary[]> { return readGames(); }
export async function getGameBySlug(slug: string): Promise<GameDetails | null> { return (await readGames(slug))[0] ?? null; }
export async function getLeaderboard(): Promise<PublicLeaderboardRow[]> {
  const games = await readGames();
  const people = new Map(games.flatMap(game => game.players.map(player => [player.playerId, player] as const)));
  return buildLeaderboard(games).map(row => ({ ...row, name: people.get(row.playerId)!.name, avatarUrl: people.get(row.playerId)!.avatarUrl }));
}
