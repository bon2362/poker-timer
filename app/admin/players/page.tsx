import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/admin/requireAdmin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminPlayers } from '@/components/admin/AdminPlayers';
export const dynamic = 'force-dynamic';
export default async function PlayersPage() {
  if (!await isAdminRequest()) redirect('/admin/login');
  return <AdminShell title="Админка" subtitle="Картинки для будущих игр"><div className="rounded-lg border border-[#3a2060] bg-[#261d36] p-4"><span className="rounded bg-[#3a2060] px-2 py-1 text-[11px] text-[#c4b5fd]">→ Для будущих игр</span><p className="mt-3 text-sm leading-relaxed text-[#b5a4cb]">Картинки отсюда таймер покажет в следующих играх. Прошедшие игры хранят свои копии и не изменятся.</p></div><AdminPlayers /></AdminShell>;
}
