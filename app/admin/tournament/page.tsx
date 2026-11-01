import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/admin/requireAdmin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminSettings } from '@/components/admin/AdminSettings';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!await isAdminRequest()) redirect('/admin/login');
  return <AdminShell title="Админка" subtitle="Турнир и запуск игры"><AdminSettings tab="tournament" /></AdminShell>;
}
