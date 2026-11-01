import { redirect } from 'next/navigation';
import { isAdminRequest } from '@/lib/admin/requireAdmin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminCi } from '@/components/admin/AdminCi';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!await isAdminRequest()) redirect('/admin/login');
  return <AdminShell title="Админка" subtitle="Тесты и выкладка"><AdminCi /></AdminShell>;
}
