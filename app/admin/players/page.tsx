import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/admin/requireAdmin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminPlayers } from '@/components/admin/AdminPlayers';
export const dynamic = 'force-dynamic';
export default async function PlayersPage() {
  if (!await isAdminRequest()) redirect('/admin/login');
  return <AdminShell title="Админка" subtitle="Картинки для будущих игр"><AdminPlayers /></AdminShell>;
}
