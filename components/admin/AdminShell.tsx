'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminFetch } from '@/lib/admin/client';
export function AdminShell({ title, subtitle, back = '/', publicSlug, children }: { title: string; subtitle?: string; back?: string; publicSlug?: string; children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); setError(''); try { await adminFetch('/api/admin/logout', 'POST'); router.push('/admin/login'); router.refresh(); } catch (e) { setError((e as Error).message); setBusy(false); } }
  return <main className="mx-auto min-h-full max-w-[1280px] bg-[#1a1a1a] text-[#ddd]"><header className="flex min-h-20 items-center justify-between gap-2 border-b border-[#2a2a2a] px-3 py-4 sm:px-6"><Link href={back} className="min-w-16 text-sm text-violet-400">{back === '/' ? '← На сайт' : '← Игры'}</Link><div className="min-w-0 text-center"><h1 className="truncate text-[13px] font-semibold uppercase tracking-[1px]">{title}</h1>{subtitle && <p className="mt-1 text-[11px] text-[#777]">{subtitle}</p>}</div>{publicSlug ? <Link href={`/games/${publicSlug}`} className="flex min-h-9 items-center whitespace-nowrap rounded-lg border border-[#333] px-3 text-xs">Страница ↗</Link> : <button disabled={busy} onClick={logout} className="min-h-9 rounded-lg border border-[#333] px-3 text-xs disabled:opacity-50">Выйти</button>}</header>
    {(pathname === '/admin' || pathname === '/admin/players') && <nav className="flex border-b border-[#2a2a2a]" aria-label="Разделы админки"><Link href="/admin" className={`flex h-[46px] flex-1 items-center justify-center text-[13px] font-medium ${pathname !== '/admin/players' ? 'border-b-2 border-violet-500 text-violet-400' : 'text-[#777]'}`}>Игры</Link><Link href="/admin/players" className={`flex h-[46px] flex-1 items-center justify-center text-[13px] font-medium ${pathname === '/admin/players' ? 'border-b-2 border-violet-500 text-violet-400' : 'text-[#777]'}`}>Игроки</Link></nav>}
    {error && <p role="alert" className="px-4 py-3 text-sm text-red-400">{error}</p>}<div className="mx-auto max-w-[1168px] px-3 py-5 pb-24 sm:px-6 sm:py-6 sm:pb-24">{children}</div>
  </main>;
}
