import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';
import { toSession, toSessionPlayer } from '@/lib/supabase/sessions';
import type { AdminGame, AdminPhoto, SavedImage } from './types';
export async function adminClient() { if (!await isAdminRequest()) redirect('/admin/login'); return getServiceClient(); }
export async function loadAdminGames(): Promise<AdminGame[]> {
  const client = await adminClient();
  const { data, error } = await client.from('sessions').select('*,session_players(*,players(name)),game_photos(count)').eq('status', 'finished').not('slug', 'is', null).order('created_at', { ascending: false });
  if (error) throw new Error('Не удалось загрузить игры. Попробуйте обновить страницу.');
  return (data ?? []).map(row => {
    const participants = (row.session_players ?? []) as Record<string, unknown>[];
    return { session: toSession(row), players: participants.map(toSessionPlayer), names: Object.fromEntries(participants.map(player => [player.player_id, (player.players as { name?: string } | null)?.name ?? 'Игрок'])), photoCount: row.game_photos?.[0]?.count ?? 0 };
  }).filter(game => game.players.some(player => player.finishPosition === 1));
}
export async function loadAdminPhotos(sessionId: string | null): Promise<{ photos: AdminPhoto[]; total: number }> {
  const client = await adminClient();
  let query = client.from('game_photos').select('*', { count: 'exact' }).order('taken_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false });
  query = sessionId === null ? query.is('session_id', null) : query.eq('session_id', sessionId);
  const { data, count, error } = await query.range(0, 47);
  if (error) throw new Error('Не удалось загрузить фото. Попробуйте обновить страницу.');
  return { photos: data ?? [], total: count ?? 0 };
}
export async function loadSavedImages(ids: string[]): Promise<SavedImage[]> {
  if (!ids.length) return []; const client = await adminClient();
  const { data, error } = await client.from('player_images').select('id,path,thumb_path').in('id', ids);
  if (error) throw new Error('Не удалось загрузить сохранённые картинки.');
  return data ?? [];
}
