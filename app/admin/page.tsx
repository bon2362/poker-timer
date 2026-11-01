import { AdminShell } from '@/components/admin/AdminShell';
import { AdminGameList } from '@/components/admin/AdminGameList';
import { loadAdminGames, adminClient } from '@/lib/admin/data';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const client = await adminClient();
  const [games, unassigned] = await Promise.all([loadAdminGames(), client.from('game_photos').select('id', { count: 'exact', head: true }).is('session_id', null)]);
  if (unassigned.error) throw new Error('Не удалось загрузить число фото.');
  return <AdminShell title="Админка" subtitle="Игры и картинки игроков"><AdminGameList games={games} unassignedCount={unassigned.count ?? 0} /></AdminShell>;
}
