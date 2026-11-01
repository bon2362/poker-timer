'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminFetch } from '@/lib/admin/client';
import { VersionBadge } from './VersionBadge';
const tabs = [{ href: '/admin', label: 'Игры' }, { href: '/admin/players', label: 'Игроки' }, { href: '/admin/tournament', label: 'Турнир' }, { href: '/admin/display', label: 'Оформление' }, { href: '/admin/ci', label: 'CI/CD' }];
export function AdminShell({ title, subtitle, back = '/', publicSlug, children }: { title: string; subtitle?: string; back?: string; publicSlug?: string; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); setError(''); try { await adminFetch('/api/admin/logout', 'POST'); router.push('/admin/login'); router.refresh(); } catch (e) { setError((e as Error).message); setBusy(false); } }
  return <main className="mx-auto min-h-full max-w-[1280px] bg-[#1a1a1a] text-[#ddd]"><header className="flex min-h-20 items-center justify-between gap-2 border-b border-[#2a2a2a] px-3 py-4 sm:px-6"><Link href={back} className="min-w-16 text-sm text-violet-400">{back === '/' ? '← На сайт' : '← Игры'}</Link><div className="min-w-0 text-center"><h1 className="truncate text-[16px] font-semibold uppercase tracking-[1px] text-[#ccc]">{title}</h1>{subtitle && <p className="mt-1 text-[11px] text-[#777]">{subtitle}</p>}{!publicSlug && back === '/' && <VersionBadge />}</div>{publicSlug ? <Link href={`/games/${publicSlug}`} className="flex min-h-9 items-center whitespace-nowrap rounded-lg border border-[#333] px-3 text-xs">Страница ↗</Link> : <button disabled={busy} onClick={logout} className="min-h-9 rounded-lg border border-[#333] px-3 text-xs disabled:opacity-50">Выйти</button>}</header>
    {tabs.some(tab => tab.href === pathname) && <nav className="flex overflow-x-auto border-b border-[#2a2a2a]" aria-label="Разделы админки">{tabs.map(tab => <Link key={tab.href} href={tab.href} className={`flex h-[46px] min-w-fit flex-1 items-center justify-center px-2.5 text-[13px] font-medium ${pathname === tab.href ? 'border-b-2 border-violet-500 text-violet-400' : 'text-[#777]'}`}>{tab.label}</Link>)}</nav>}
    {error && <p role="alert" className="px-4 py-3 text-sm text-red-400">{error}</p>}<div className="mx-auto max-w-[1168px] px-3 py-5 pb-24 sm:px-6 sm:py-6 sm:pb-24">{children}</div>
  </main>;
}
