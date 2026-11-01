import { AdminShell } from '@/components/admin/AdminShell';
import { AdminGameList } from '@/components/admin/AdminGameList';
import { loadAdminGames, adminClient } from '@/lib/admin/data';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const client = await adminClient();
  const [games, unassigned] = await Promise.all([loadAdminGames(), client.from('game_photos').select('path,thumb_path', { count: 'exact' }).is('session_id', null).order('taken_at', { ascending: false, nullsFirst: false }).limit(3)]);
  if (unassigned.error) throw new Error('Не удалось загрузить число фото.');
  return <AdminShell title="Админка" subtitle="Игры и картинки игроков"><AdminGameList games={games} unassignedCount={unassigned.count ?? 0} previews={(unassigned.data ?? []).map(photo => photo.thumb_path || photo.path)} /></AdminShell>;
}
